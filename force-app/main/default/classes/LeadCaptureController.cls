/**
 * @description Controller for the Lead Capture Form LWC component.
 *              Handles server-side validation and Lead record creation.
 */
public with sharing class LeadCaptureController {

    /**
     * @description Submits a new Lead from the capture form.
     *              Handles a single record per call; bulkification is not needed
     *              because this is a user-initiated, real-time form submission.
     * @param input The lead data collected from the form.
     * @return The Id of the newly inserted Lead.
     */
    @AuraEnabled
    public static Id submitLead(LeadCaptureInput input) {
        validateInput(input);

        Lead lead = buildLead(input);

        try {
            insert lead;
        } catch (DmlException e) {
            throw new AuraHandledException(e.getMessage());
        }

        return lead.Id;
    }

    private static void validateInput(LeadCaptureInput input) {
        if (String.isBlank(input.lastName)) {
            throw new AuraHandledException('Last Name is required.');
        }
        if (String.isBlank(input.company)) {
            throw new AuraHandledException('Company is required.');
        }
        if (String.isBlank(input.email) || !Pattern.matches(
                '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$', input.email)) {
            throw new AuraHandledException('A valid Email is required.');
        }
        if (String.isNotBlank(input.sourceAccountId)) {
            List<Account> accounts = [
                SELECT Id FROM Account WHERE Id = :input.sourceAccountId LIMIT 1
            ];
            if (accounts.isEmpty()) {
                throw new AuraHandledException('Source Account not found.');
            }
        }
    }

    private static Lead buildLead(LeadCaptureInput input) {
        Lead lead = new Lead(
            FirstName        = input.firstName,
            LastName         = input.lastName,
            Company          = input.company,
            Email            = input.email,
            Phone            = input.phone,
            LeadSource       = input.leadSource,
            Capture_Notes__c = input.notes
        );
        if (String.isNotBlank(input.sourceAccountId)) {
            lead.Source_Account__c = input.sourceAccountId;
        }
        return lead;
    }

    /** @description Inner class representing the form payload sent from the LWC. */
    public class LeadCaptureInput {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String company;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String leadSource;
        @AuraEnabled public String notes;
        @AuraEnabled public String sourceAccountId;
    }
}
