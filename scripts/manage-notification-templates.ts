#!/usr/bin/env tsx
/** @format */

import 'dotenv/config';
import { notificationService } from '../src/lib/notificationService';
import { notificationTemplateManager } from '../src/lib/notificationTemplateManager';
import { NOTIFICATION_TYPES } from '../src/types/notification';

/**
 * Utility script for managing notification templates
 */

/**
 * List all notification templates
 */
async function listTemplates() {
    try {
        console.log('📋 Listing all notification templates...\n');

        for (const type of Object.values(NOTIFICATION_TYPES)) {
            const template = await notificationService.getTemplate(type);

            if (template) {
                console.log(`🔹 ${type}`);
                console.log(`   Title: ${template.title}`);
                console.log(`   Message: ${template.message}`);
                console.log(`   Priority: ${template.defaultPriority}`);
                console.log(`   Roles: ${template.roles?.join(', ') || 'All'}`);
                console.log(`   Created: ${template.createdAt.toISOString()}`);
                console.log('');
            } else {
                console.log(`❌ ${type} - Template not found`);
            }
        }

    } catch (error) {
        console.error('❌ Error listing templates:', error);
        throw error;
    }
}

/**
 * Reinitialize all default templates (useful for updates)
 */
async function reinitializeTemplates() {
    try {
        console.log('🔄 Reinitializing all default templates...');
        await notificationTemplateManager.initializeDefaultTemplates();
        console.log('✅ Templates reinitialized successfully!');

    } catch (error) {
        console.error('❌ Error reinitializing templates:', error);
        throw error;
    }
}

/**
 * Test template rendering with sample data
 */
async function testTemplateRendering() {
    try {
        console.log('🧪 Testing template rendering...\n');

        // Test user registration template
        const userRegTemplate = await notificationTemplateManager.getRenderedNotification(
            NOTIFICATION_TYPES.USER_REGISTERED,
            {
                userName: 'John Doe',
                userEmail: 'john.doe@example.com',
                userRole: 'customer'
            }
        );

        if (userRegTemplate) {
            console.log('✅ User Registration Template:');
            console.log(`   Title: ${userRegTemplate.title}`);
            console.log(`   Message: ${userRegTemplate.message}`);
            console.log(`   Priority: ${userRegTemplate.priority}\n`);
        }

        // Test system cleanup template with conditional content
        const cleanupTemplate = await notificationTemplateManager.getRenderedNotification(
            NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED,
            {
                deletedCount: 15,
                archivedCount: 8,
                hasErrors: true,
                errorCount: 2
            }
        );

        if (cleanupTemplate) {
            console.log('✅ System Cleanup Template (with errors):');
            console.log(`   Title: ${cleanupTemplate.title}`);
            console.log(`   Message: ${cleanupTemplate.message}`);
            console.log(`   Priority: ${cleanupTemplate.priority}\n`);
        }

        // Test system cleanup template without errors
        const cleanupTemplateNoErrors = await notificationTemplateManager.getRenderedNotification(
            NOTIFICATION_TYPES.SYSTEM_CLEANUP_COMPLETED,
            {
                deletedCount: 10,
                archivedCount: 5,
                hasErrors: false
            }
        );

        if (cleanupTemplateNoErrors) {
            console.log('✅ System Cleanup Template (no errors):');
            console.log(`   Title: ${cleanupTemplateNoErrors.title}`);
            console.log(`   Message: ${cleanupTemplateNoErrors.message}`);
            console.log(`   Priority: ${cleanupTemplateNoErrors.priority}\n`);
        }

        // Test role-based filtering
        console.log('🔐 Testing role-based filtering...');
        const isAdminAllowed = await notificationTemplateManager.isNotificationAllowedForRole(
            NOTIFICATION_TYPES.USER_REGISTERED,
            'admin'
        );
        const isCustomerAllowed = await notificationTemplateManager.isNotificationAllowedForRole(
            NOTIFICATION_TYPES.USER_REGISTERED,
            'customer'
        );

        console.log(`   USER_REGISTERED for admin: ${isAdminAllowed ? '✅' : '❌'}`);
        console.log(`   USER_REGISTERED for customer: ${isCustomerAllowed ? '✅' : '❌'}`);

        const adminTypes = await notificationTemplateManager.getNotificationTypesForRole('admin');
        const customerTypes = await notificationTemplateManager.getNotificationTypesForRole('customer');

        console.log(`   Admin notification types: ${adminTypes.length}`);
        console.log(`   Customer notification types: ${customerTypes.length}\n`);

        console.log('✅ Template rendering tests completed!');

    } catch (error) {
        console.error('❌ Error testing template rendering:', error);
        throw error;
    }
}

/**
 * Validate all templates
 */
async function validateTemplates() {
    try {
        console.log('🔍 Validating all templates...\n');

        let validCount = 0;
        let invalidCount = 0;

        for (const type of Object.values(NOTIFICATION_TYPES)) {
            const template = await notificationService.getTemplate(type);

            if (template) {
                // Basic validation
                const isValid = template.title &&
                    template.message &&
                    template.defaultPriority &&
                    ['low', 'normal', 'high', 'urgent'].includes(template.defaultPriority);

                if (isValid) {
                    console.log(`✅ ${type} - Valid`);
                    validCount++;
                } else {
                    console.log(`❌ ${type} - Invalid (missing required fields)`);
                    invalidCount++;
                }
            } else {
                console.log(`❌ ${type} - Missing template`);
                invalidCount++;
            }
        }

        console.log(`\n📊 Validation Summary:`);
        console.log(`   Valid templates: ${validCount}`);
        console.log(`   Invalid/Missing templates: ${invalidCount}`);
        console.log(`   Total expected: ${Object.values(NOTIFICATION_TYPES).length}`);

        if (invalidCount === 0) {
            console.log('✅ All templates are valid!');
        } else {
            console.log('⚠️ Some templates need attention');
        }

    } catch (error) {
        console.error('❌ Error validating templates:', error);
        throw error;
    }
}

// Command line interface
async function main() {
    const command = process.argv[2];

    switch (command) {
        case 'list':
            await listTemplates();
            break;
        case 'reinit':
            await reinitializeTemplates();
            break;
        case 'test':
            await testTemplateRendering();
            break;
        case 'validate':
            await validateTemplates();
            break;
        case 'all':
            await listTemplates();
            await validateTemplates();
            await testTemplateRendering();
            break;
        default:
            console.log('📖 Notification Template Manager');
            console.log('');
            console.log('Usage: tsx scripts/manage-notification-templates.ts <command>');
            console.log('');
            console.log('Commands:');
            console.log('  list      - List all notification templates');
            console.log('  reinit    - Reinitialize all default templates');
            console.log('  test      - Test template rendering with sample data');
            console.log('  validate  - Validate all templates');
            console.log('  all       - Run list, validate, and test commands');
            console.log('');
            console.log('Examples:');
            console.log('  tsx scripts/manage-notification-templates.ts list');
            console.log('  tsx scripts/manage-notification-templates.ts test');
            process.exit(1);
    }
}

if (require.main === module) {
    main()
        .then(() => {
            console.log('✨ Command completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Command failed:', error);
            process.exit(1);
        });
}

export { listTemplates, reinitializeTemplates, testTemplateRendering, validateTemplates };