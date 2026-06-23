import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import ACCOUNT_NAME_FIELD from '@salesforce/schema/Account.Name';
import submitLead from '@salesforce/apex/LeadCaptureController.submitLead';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const LEAD_SOURCE_OPTIONS = [
    { label: 'Web', value: 'Web' },
    { label: 'Phone Inquiry', value: 'Phone Inquiry' },
    { label: 'Partner Referral', value: 'Partner Referral' },
    { label: 'Purchased List', value: 'Purchased List' },
    { label: 'Other', value: 'Other' }
];

export default class LeadCaptureForm extends LightningElement {
    @api recordId;

    @track firstName   = '';
    @track lastName    = '';
    @track company     = '';
    @track email       = '';
    @track phone       = '';
    @track leadSource  = '';
    @track notes       = '';
    @track isLoading   = false;
    @track errorMessage = '';

    leadSourceOptions = LEAD_SOURCE_OPTIONS;

    @wire(getRecord, { recordId: '$recordId', fields: [ACCOUNT_NAME_FIELD] })
    wiredAccount({ data }) {
        if (data) {
            this.company = getFieldValue(data, ACCOUNT_NAME_FIELD) ?? '';
        }
    }

    get hasRecordId() {
        return !!this.recordId;
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.detail.value;
    }

    handleSubmit() {
        if (!this.validateForm()) {
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        const input = {
            firstName:       this.firstName,
            lastName:        this.lastName,
            company:         this.company,
            email:           this.email,
            phone:           this.phone,
            leadSource:      this.leadSource,
            notes:           this.notes,
            sourceAccountId: this.recordId ?? null
        };

        submitLead({ input })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title:   'Success',
                    message: 'Lead captured successfully!',
                    variant: 'success'
                }));
                this.resetForm();
            })
            .catch((error) => {
                this.dispatchEvent(new ShowToastEvent({
                    title:   'Error',
                    message: error?.body?.message ?? 'An unexpected error occurred.',
                    variant: 'error'
                }));
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    validateForm() {
        if (!this.lastName?.trim()) {
            this.errorMessage = 'Last Name is required.';
            return false;
        }
        if (!this.company?.trim()) {
            this.errorMessage = 'Company is required.';
            return false;
        }
        if (!this.email?.trim() || !EMAIL_REGEX.test(this.email)) {
            this.errorMessage = 'A valid Email is required.';
            return false;
        }
        this.errorMessage = '';
        return true;
    }

    resetForm() {
        this.firstName  = '';
        this.lastName   = '';
        this.email      = '';
        this.phone      = '';
        this.leadSource = '';
        this.notes      = '';
        // Preserve company if it comes from the wired account
        if (!this.recordId) {
            this.company = '';
        }
    }
}
