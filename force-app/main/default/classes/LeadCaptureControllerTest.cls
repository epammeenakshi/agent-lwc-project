/**
 * @description Test class for LeadCaptureController.
 *              Covers positive, negative, and edge-case scenarios.
 */
@IsTest
private class LeadCaptureControllerTest {

    @TestSetup
    static void setupTestData() {
        insert new Account(Name = 'Test Account');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private static LeadCaptureController.LeadCaptureInput buildValidInput() {
        LeadCaptureController.LeadCaptureInput input = new LeadCaptureController.LeadCaptureInput();
        input.firstName  = 'Jane';
        input.lastName   = 'Doe';
        input.company    = 'Acme Corp';
        input.email      = 'jane.doe@example.com';
        input.phone      = '555-1234';
        input.leadSource = 'Web';
        input.notes      = 'Test notes';
        return input;
    }

    // ─── Positive Tests ──────────────────────────────────────────────────────

    @IsTest
    static void testSubmitLead_success() {
        LeadCaptureController.LeadCaptureInput input = buildValidInput();

        Test.startTest();
        Id leadId = LeadCaptureController.submitLead(input);
        Test.stopTest();

        Assert.isNotNull(leadId, 'Returned Id should not be null');
        Lead inserted = [SELECT LastName, Company, Email FROM Lead WHERE Id = :leadId];
        Assert.areEqual('Doe', inserted.LastName);
        Assert.areEqual('Acme Corp', inserted.Company);
        Assert.areEqual('jane.doe@example.com', inserted.Email);
    }

    @IsTest
    static void testSubmitLead_withAccount() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        LeadCaptureController.LeadCaptureInput input = buildValidInput();
        input.sourceAccountId = acc.Id;

        Test.startTest();
        Id leadId = LeadCaptureController.submitLead(input);
        Test.stopTest();

        Lead inserted = [SELECT Source_Account__c FROM Lead WHERE Id = :leadId];
        Assert.areEqual(acc.Id, inserted.Source_Account__c, 'Source_Account__c should match');
    }

    // ─── Negative Tests ──────────────────────────────────────────────────────

    @IsTest
    static void testSubmitLead_missingLastName() {
        LeadCaptureController.LeadCaptureInput input = buildValidInput();
        input.lastName = '';

        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            LeadCaptureController.submitLead(input);
            Assert.fail('Expected AuraHandledException was not thrown');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'AuraHandledException should have been thrown for blank last name');
    }

    @IsTest
    static void testSubmitLead_missingCompany() {
        LeadCaptureController.LeadCaptureInput input = buildValidInput();
        input.company = '';

        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            LeadCaptureController.submitLead(input);
            Assert.fail('Expected AuraHandledException was not thrown');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'AuraHandledException should have been thrown for blank company');
    }

    @IsTest
    static void testSubmitLead_missingEmail() {
        LeadCaptureController.LeadCaptureInput input = buildValidInput();
        input.email = '';

        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            LeadCaptureController.submitLead(input);
            Assert.fail('Expected AuraHandledException was not thrown');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'AuraHandledException should have been thrown for blank email');
    }

    @IsTest
    static void testSubmitLead_invalidEmail() {
        LeadCaptureController.LeadCaptureInput input = buildValidInput();
        input.email = 'not-an-email';

        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            LeadCaptureController.submitLead(input);
            Assert.fail('Expected AuraHandledException was not thrown');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'AuraHandledException should have been thrown for invalid email format');
    }

    @IsTest
    static void testSubmitLead_invalidAccountId() {
        LeadCaptureController.LeadCaptureInput input = buildValidInput();
        input.sourceAccountId = '001000000000000AAA'; // Non-existent Id

        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            LeadCaptureController.submitLead(input);
            Assert.fail('Expected AuraHandledException was not thrown');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'AuraHandledException should have been thrown for non-existent account');
    }
}
