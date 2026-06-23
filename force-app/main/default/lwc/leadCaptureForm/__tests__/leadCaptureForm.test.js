import { createElement } from "lwc";
import LeadCaptureForm from "c/leadCaptureForm";
import { registerLdsTestWireAdapter } from "@salesforce/sfdx-lwc-jest";
import { getRecord } from "lightning/uiRecordApi";
import submitLead from "@salesforce/apex/LeadCaptureController.submitLead";

jest.mock(
  "@salesforce/apex/LeadCaptureController.submitLead",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const mockGetRecord = registerLdsTestWireAdapter(getRecord);

function createComponent(props = {}) {
  const el = createElement("c-lead-capture-form", { is: LeadCaptureForm });
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function setField(el, dataField, value) {
  const input = el.shadowRoot.querySelector(`[data-field="${dataField}"]`);
  input.value = value;
  input.dispatchEvent(
    new CustomEvent("change", { detail: { value }, bubbles: false })
  );
}

function fillValidForm(el) {
  setField(el, "firstName", "Jane");
  setField(el, "lastName", "Doe");
  setField(el, "company", "Acme Corp");
  setField(el, "email", "jane.doe@example.com");
}

// Drain the microtask queue fully (resolves .then, .catch, .finally chains)
function flushPromises() {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

function clickSubmit(el) {
  el.shadowRoot.querySelector("lightning-button").click();
}

describe("c-lead-capture-form", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  // ─── Rendering ────────────────────────────────────────────────────────────

  describe("initial render", () => {
    it("renders all expected input fields", () => {
      const el = createComponent();
      [
        "firstName",
        "lastName",
        "company",
        "email",
        "phone",
        "notes",
        "leadSource"
      ].forEach((field) => {
        expect(
          el.shadowRoot.querySelector(`[data-field="${field}"]`)
        ).not.toBeNull();
      });
    });

    it("renders a submit button with label Submit", () => {
      const el = createComponent();
      const btn = el.shadowRoot.querySelector("lightning-button");
      expect(btn).not.toBeNull();
      expect(btn.label).toBe("Submit");
    });

    it("does not show error message on initial render", () => {
      const el = createComponent();
      expect(el.shadowRoot.querySelector(".slds-notify_alert")).toBeNull();
    });

    it("does not show spinner on initial render", () => {
      const el = createComponent();
      expect(el.shadowRoot.querySelector("lightning-spinner")).toBeNull();
    });
  });

  // ─── hasRecordId ──────────────────────────────────────────────────────────

  describe("hasRecordId", () => {
    it("company field is editable when no recordId is provided", () => {
      const el = createComponent();
      const company = el.shadowRoot.querySelector('[data-field="company"]');
      expect(company.readOnly).toBeFalsy();
    });

    it("company field is read-only when recordId is set", () => {
      const el = createComponent({ recordId: "001000000000001AAA" });
      const company = el.shadowRoot.querySelector('[data-field="company"]');
      expect(company.readOnly).toBe(true);
    });
  });

  // ─── Wire service ─────────────────────────────────────────────────────────

  describe("wire getRecord", () => {
    it("populates company from wired account name", async () => {
      const el = createComponent({ recordId: "001000000000001AAA" });
      mockGetRecord.emit({ fields: { Name: { value: "Wired Corp" } } });
      await Promise.resolve();

      expect(el.shadowRoot.querySelector('[data-field="company"]').value).toBe(
        "Wired Corp"
      );
    });

    it("shows error message when wire returns an error", async () => {
      const el = createComponent({ recordId: "001000000000001AAA" });
      mockGetRecord.error();
      await Promise.resolve();

      const errorDiv = el.shadowRoot.querySelector(".slds-notify_alert");
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.textContent).toContain(
        "Failed to load account information"
      );
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  describe("validateForm", () => {
    it("shows error and blocks submit when last name is blank", async () => {
      const el = createComponent();
      setField(el, "company", "Acme");
      setField(el, "email", "test@example.com");
      clickSubmit(el);
      await Promise.resolve();

      expect(
        el.shadowRoot.querySelector(".slds-notify_alert").textContent
      ).toContain("Last Name is required");
      expect(submitLead).not.toHaveBeenCalled();
    });

    it("shows error and blocks submit when company is blank", async () => {
      const el = createComponent();
      setField(el, "lastName", "Doe");
      setField(el, "email", "test@example.com");
      clickSubmit(el);
      await Promise.resolve();

      expect(
        el.shadowRoot.querySelector(".slds-notify_alert").textContent
      ).toContain("Company is required");
      expect(submitLead).not.toHaveBeenCalled();
    });

    it("shows error and blocks submit when email is blank", async () => {
      const el = createComponent();
      setField(el, "lastName", "Doe");
      setField(el, "company", "Acme");
      clickSubmit(el);
      await Promise.resolve();

      expect(
        el.shadowRoot.querySelector(".slds-notify_alert").textContent
      ).toContain("valid Email");
      expect(submitLead).not.toHaveBeenCalled();
    });

    it("shows error and blocks submit for an invalid email format", async () => {
      const el = createComponent();
      setField(el, "lastName", "Doe");
      setField(el, "company", "Acme");
      setField(el, "email", "not-an-email");
      clickSubmit(el);
      await Promise.resolve();

      expect(
        el.shadowRoot.querySelector(".slds-notify_alert").textContent
      ).toContain("valid Email");
      expect(submitLead).not.toHaveBeenCalled();
    });

    it("clears validation error before calling Apex", async () => {
      submitLead.mockResolvedValue("001xxx");
      const el = createComponent();

      // Trigger a validation error first
      setField(el, "lastName", "Doe");
      setField(el, "company", "Acme");
      clickSubmit(el);
      await Promise.resolve();
      expect(el.shadowRoot.querySelector(".slds-notify_alert")).not.toBeNull();

      // Now fill email and resubmit
      setField(el, "email", "jane@example.com");
      clickSubmit(el);
      await Promise.resolve();

      expect(el.shadowRoot.querySelector(".slds-notify_alert")).toBeNull();
    });
  });

  // ─── Submission ───────────────────────────────────────────────────────────

  describe("handleSubmit", () => {
    it("calls submitLead with the correct input payload", async () => {
      submitLead.mockResolvedValue("001xxx");
      const el = createComponent();
      fillValidForm(el);
      setField(el, "phone", "555-1234");
      setField(el, "notes", "A note");
      clickSubmit(el);
      await flushPromises();

      expect(submitLead).toHaveBeenCalledWith({
        input: expect.objectContaining({
          firstName: "Jane",
          lastName: "Doe",
          company: "Acme Corp",
          email: "jane.doe@example.com",
          phone: "555-1234",
          notes: "A note",
          sourceAccountId: null
        })
      });
    });

    it("passes sourceAccountId when recordId is present", async () => {
      submitLead.mockResolvedValue("001xxx");
      const el = createComponent({ recordId: "001000000000001AAA" });
      mockGetRecord.emit({ fields: { Name: { value: "Wired Corp" } } });
      await Promise.resolve();

      setField(el, "lastName", "Doe");
      setField(el, "email", "jane@example.com");
      clickSubmit(el);
      await flushPromises();

      expect(submitLead).toHaveBeenCalledWith({
        input: expect.objectContaining({
          sourceAccountId: "001000000000001AAA"
        })
      });
    });

    it("shows spinner while submit is in progress", async () => {
      let resolve;
      submitLead.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        })
      );
      const el = createComponent();
      fillValidForm(el);
      clickSubmit(el);
      await Promise.resolve();

      expect(el.shadowRoot.querySelector("lightning-spinner")).not.toBeNull();
      expect(el.shadowRoot.querySelector("lightning-button").disabled).toBe(
        true
      );

      resolve("001xxx");
      await flushPromises();
    });

    it("hides spinner and re-enables button after successful submit", async () => {
      submitLead.mockResolvedValue("001xxx");
      const el = createComponent();
      fillValidForm(el);
      clickSubmit(el);
      await flushPromises();

      expect(el.shadowRoot.querySelector("lightning-spinner")).toBeNull();
      expect(
        el.shadowRoot.querySelector("lightning-button").disabled
      ).toBeFalsy();
    });

    it("resets form fields after successful submit", async () => {
      submitLead.mockResolvedValue("001xxx");
      const el = createComponent();
      fillValidForm(el);
      clickSubmit(el);
      await flushPromises();

      expect(el.shadowRoot.querySelector('[data-field="lastName"]').value).toBe(
        ""
      );
      expect(el.shadowRoot.querySelector('[data-field="email"]').value).toBe(
        ""
      );
      expect(el.shadowRoot.querySelector('[data-field="company"]').value).toBe(
        ""
      );
    });

    it("preserves company field after reset when recordId is set", async () => {
      submitLead.mockResolvedValue("001xxx");
      const el = createComponent({ recordId: "001000000000001AAA" });
      mockGetRecord.emit({ fields: { Name: { value: "Wired Corp" } } });
      await Promise.resolve();

      setField(el, "lastName", "Doe");
      setField(el, "email", "jane@example.com");
      clickSubmit(el);
      await flushPromises();

      expect(el.shadowRoot.querySelector('[data-field="company"]').value).toBe(
        "Wired Corp"
      );
    });

    it("hides spinner after a failed submit", async () => {
      submitLead.mockRejectedValue({ body: { message: "Server error" } });
      const el = createComponent();
      fillValidForm(el);
      clickSubmit(el);
      await flushPromises();

      expect(el.shadowRoot.querySelector("lightning-spinner")).toBeNull();
    });
  });
});
