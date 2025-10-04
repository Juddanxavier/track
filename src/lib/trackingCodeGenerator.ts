/** @format */

import { db } from '@/database/db';
import { shipments } from '@/database/schema';
import { eq } from 'drizzle-orm';
import {
    INTERNAL_TRACKING_CODE_PREFIX,
    INTERNAL_TRACKING_CODE_LENGTH,
    INTERNAL_TRACKING_CODE_PATTERN,
    TrackingCodeError,
} from '@/types/shipment';

/**
 * Utility class for generating and validating internal tracking codes
 * Generates unique codes in format SC + 9 digits for public tracking
 */
export class TrackingCodeGenerator {
    private readonly maxRetries: number = 5;
    private readonly entropyPool: number[] = [];

    /**
     * Generate a unique internal tracking code in format SC + 9 digits
     * Ensures sufficient entropy and collision prevention
     */
    async generateInternalTrackingCode(): Promise<string> {
        let attempts = 0;

        while (attempts < this.maxRetries) {
            // Generate 9 random digits with high entropy
            const digits = this.generateHighEntropyDigits();
            const trackingCode = `${INTERNAL_TRACKING_CODE_PREFIX}${digits}`;

            // Validate format
            if (!this.validateFormat(trackingCode)) {
                attempts++;
                continue;
            }

            // Check if this code already exists in database
            const isUnique = await this.checkUniqueness(trackingCode);
            if (isUnique) {
                return trackingCode;
            }

            attempts++;
        }

        throw new TrackingCodeError(
            `Failed to generate unique internal tracking code after ${this.maxRetries} attempts`,
            { attempts: this.maxRetries }
        );
    }

    /**
     * Generate high entropy digits to reduce collision probability
     */
    private generateHighEntropyDigits(): string {
        // Use crypto.getRandomValues if available for better entropy
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint32Array(3);
            crypto.getRandomValues(array);

            // Combine the random values to create a 9-digit number
            const combined = (array[0] % 1000) * 1000000 +
                (array[1] % 1000) * 1000 +
                (array[2] % 1000);

            return combined.toString().padStart(9, '0');
        }

        // Fallback to Math.random with additional entropy
        const timestamp = Date.now() % 1000; // Last 3 digits of timestamp
        const random1 = Math.floor(Math.random() * 1000000); // 6 random digits
        const combined = timestamp * 1000000 + random1;

        return (combined % 1000000000).toString().padStart(9, '0');
    }

    /**
     * Generate multiple unique internal tracking codes for white label tracking
     */
    async generateMultipleInternalTrackingCodes(count: number): Promise<string[]> {
        if (count <= 0) {
            throw new TrackingCodeError('Count must be greater than 0');
        }

        if (count > 100) {
            throw new TrackingCodeError('Cannot generate more than 100 tracking codes at once');
        }

        const codes: string[] = [];
        const generatedCodes = new Set<string>();

        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let code: string;

            while (attempts < this.maxRetries) {
                // Generate high entropy digits
                const digits = this.generateHighEntropyDigits();
                code = `${INTERNAL_TRACKING_CODE_PREFIX}${digits}`;

                // Check if we've already generated this code in this batch
                if (generatedCodes.has(code)) {
                    attempts++;
                    continue;
                }

                // Validate format
                if (!this.validateFormat(code)) {
                    attempts++;
                    continue;
                }

                // Check if this code already exists in database
                const isUnique = await this.checkUniqueness(code);
                if (isUnique) {
                    codes.push(code);
                    generatedCodes.add(code);
                    break;
                }

                attempts++;
            }

            if (attempts >= this.maxRetries) {
                throw new TrackingCodeError(
                    `Failed to generate unique internal tracking code ${i + 1} of ${count} after ${this.maxRetries} attempts`,
                    {
                        generatedCount: codes.length,
                        requestedCount: count,
                        failedAtIndex: i
                    }
                );
            }
        }

        return codes;
    }

    /**
     * Validate internal tracking code format for white label tracking
     */
    validateFormat(trackingCode: string): boolean {
        if (!trackingCode || typeof trackingCode !== 'string') {
            return false;
        }

        // Check length
        if (trackingCode.length !== INTERNAL_TRACKING_CODE_LENGTH) {
            return false;
        }

        // Check pattern (SC + 9 digits)
        return INTERNAL_TRACKING_CODE_PATTERN.test(trackingCode);
    }

    /**
     * Check if internal tracking code is unique in database
     * Ensures white label tracking codes don't collide
     */
    async checkUniqueness(trackingCode: string): Promise<boolean> {
        try {
            const existing = await db
                .select({ id: shipments.id })
                .from(shipments)
                .where(eq(shipments.internalTrackingCode, trackingCode))
                .limit(1);

            return existing.length === 0;
        } catch (error) {
            throw new TrackingCodeError(
                'Failed to check internal tracking code uniqueness',
                { trackingCode, error: error instanceof Error ? error.message : 'Unknown error' }
            );
        }
    }

    /**
     * Validate that a tracking code collision won't occur
     * Additional entropy check for white label security
     */
    async validateCollisionResistance(trackingCode: string): Promise<boolean> {
        // Check if the code has sufficient entropy (no obvious patterns)
        const digits = trackingCode.substring(2); // Remove SC prefix

        // Check for sequential patterns (123456789, 987654321)
        const isSequential = this.isSequentialPattern(digits);
        if (isSequential) {
            return false;
        }

        // Check for repetitive patterns (111111111, 123123123)
        const isRepetitive = this.isRepetitivePattern(digits);
        if (isRepetitive) {
            return false;
        }

        // Check database uniqueness
        return await this.checkUniqueness(trackingCode);
    }

    /**
     * Check if digits form a sequential pattern
     */
    private isSequentialPattern(digits: string): boolean {
        const nums = digits.split('').map(Number);

        // Check ascending sequence
        let isAscending = true;
        let isDescending = true;

        for (let i = 1; i < nums.length; i++) {
            if (nums[i] !== nums[i - 1] + 1) {
                isAscending = false;
            }
            if (nums[i] !== nums[i - 1] - 1) {
                isDescending = false;
            }
        }

        return isAscending || isDescending;
    }

    /**
     * Check if digits form a repetitive pattern
     */
    private isRepetitivePattern(digits: string): boolean {
        // Check for all same digits
        const firstDigit = digits[0];
        if (digits.split('').every(d => d === firstDigit)) {
            return true;
        }

        // Check for repeating patterns (123123123, 121212121)
        for (let patternLength = 1; patternLength <= 3; patternLength++) {
            const pattern = digits.substring(0, patternLength);
            const repeated = pattern.repeat(Math.ceil(digits.length / patternLength)).substring(0, digits.length);
            if (digits === repeated) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate white label tracking code with custom branding (for special cases)
     * Maintains security by not exposing carrier information
     */
    async generateBrandedTrackingCode(brandPrefix: string = 'SC', digitCount: number = 9): Promise<string> {
        if (!brandPrefix || typeof brandPrefix !== 'string') {
            throw new TrackingCodeError('Brand prefix must be a non-empty string');
        }

        if (digitCount < 6 || digitCount > 12) {
            throw new TrackingCodeError('Digit count must be between 6 and 12 for security');
        }

        let attempts = 0;

        while (attempts < this.maxRetries) {
            // Generate high entropy digits
            const digits = this.generateHighEntropyDigits().substring(0, digitCount);
            const trackingCode = `${brandPrefix}${digits}`;

            // Validate collision resistance
            const isSecure = await this.validateCollisionResistance(trackingCode);
            if (isSecure) {
                return trackingCode;
            }

            attempts++;
        }

        throw new TrackingCodeError(
            `Failed to generate secure branded tracking code with prefix "${brandPrefix}" after ${this.maxRetries} attempts`,
            { brandPrefix, digitCount, attempts: this.maxRetries }
        );
    }

    /**
     * Parse internal tracking code to extract components (white label safe)
     */
    parseInternalTrackingCode(trackingCode: string): {
        prefix: string;
        digits: string;
        isValid: boolean;
        isWhiteLabel: boolean;
    } {
        if (!this.validateFormat(trackingCode)) {
            return {
                prefix: '',
                digits: '',
                isValid: false,
                isWhiteLabel: false,
            };
        }

        return {
            prefix: trackingCode.substring(0, 2), // First 2 characters (SC)
            digits: trackingCode.substring(2),    // Remaining 9 digits
            isValid: true,
            isWhiteLabel: true, // All our internal codes are white label
        };
    }

    /**
     * Sanitize tracking information for public display
     * Ensures no carrier-specific information is exposed
     */
    sanitizeForPublicDisplay(trackingCode: string): {
        publicCode: string;
        displayFormat: string;
        isValid: boolean;
    } {
        const parsed = this.parseInternalTrackingCode(trackingCode);

        if (!parsed.isValid) {
            return {
                publicCode: '',
                displayFormat: '',
                isValid: false,
            };
        }

        // Format for public display: SC-123-456-789
        const digits = parsed.digits;
        const formatted = `${parsed.prefix}-${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6, 9)}`;

        return {
            publicCode: trackingCode,
            displayFormat: formatted,
            isValid: true,
        };
    }

    /**
     * Generate white label tracking code with enhanced collision handling
     */
    async generateWithRetry(
        maxRetries: number = this.maxRetries,
        onCollision?: (attempt: number, code: string) => void
    ): Promise<string> {
        let attempts = 0;

        while (attempts < maxRetries) {
            // Generate high entropy digits
            const digits = this.generateHighEntropyDigits();
            const trackingCode = `${INTERNAL_TRACKING_CODE_PREFIX}${digits}`;

            // Check collision resistance (includes uniqueness check)
            const isSecure = await this.validateCollisionResistance(trackingCode);
            if (isSecure) {
                return trackingCode;
            }

            // Call collision callback if provided
            if (onCollision) {
                onCollision(attempts + 1, trackingCode);
            }

            attempts++;
        }

        throw new TrackingCodeError(
            `Failed to generate secure white label tracking code after ${maxRetries} attempts`,
            { attempts: maxRetries }
        );
    }

    /**
     * Validate and normalize internal tracking code input for white label lookup
     */
    normalizeInternalTrackingCode(input: string): string | null {
        if (!input || typeof input !== 'string') {
            return null;
        }

        // Remove whitespace, hyphens, and convert to uppercase
        let normalized = input.trim().toUpperCase().replace(/[-\s]/g, '');

        // Handle formatted input (SC-123-456-789 -> SC123456789)
        if (normalized.includes('-')) {
            normalized = normalized.replace(/-/g, '');
        }

        // Validate format
        if (!this.validateFormat(normalized)) {
            return null;
        }

        return normalized;
    }

    /**
     * Check if input might be a carrier tracking number (security check)
     * Prevents accidental exposure of carrier tracking numbers
     */
    isCarrierTrackingNumber(input: string): boolean {
        if (!input || typeof input !== 'string') {
            return false;
        }

        const clean = input.trim().toUpperCase();

        // Common carrier patterns that should NOT be accepted as internal codes
        const carrierPatterns = [
            /^1Z[A-Z0-9]{16}$/, // UPS
            /^\d{12,14}$/, // FedEx
            /^\d{10,11}$/, // DHL
            /^9[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}$/, // USPS Priority
            /^7\d{19}$/, // USPS Certified
        ];

        return carrierPatterns.some(pattern => pattern.test(clean));
    }

    /**
     * Check if an internal tracking code exists in the system (white label lookup)
     */
    async exists(trackingCode: string): Promise<boolean> {
        // Normalize the input first
        const normalized = this.normalizeInternalTrackingCode(trackingCode);
        if (!normalized) {
            return false;
        }

        // Security check: reject if it looks like a carrier tracking number
        if (this.isCarrierTrackingNumber(trackingCode)) {
            return false;
        }

        return !(await this.checkUniqueness(normalized));
    }

    /**
     * Get statistics about white label tracking code generation
     */
    getStatistics(): {
        prefix: string;
        digitCount: number;
        totalPossibleCodes: number;
        pattern: RegExp;
        isWhiteLabel: boolean;
        securityFeatures: string[];
    } {
        return {
            prefix: INTERNAL_TRACKING_CODE_PREFIX,
            digitCount: 9,
            totalPossibleCodes: 1000000000, // 10^9
            pattern: INTERNAL_TRACKING_CODE_PATTERN,
            isWhiteLabel: true,
            securityFeatures: [
                'High entropy generation',
                'Collision resistance validation',
                'Pattern detection prevention',
                'Carrier number rejection',
                'Format normalization'
            ],
        };
    }
}

// Export singleton instance
export const trackingCodeGenerator = new TrackingCodeGenerator();

// Export utility functions for white label tracking
export const generateInternalTrackingCode = () => trackingCodeGenerator.generateInternalTrackingCode();
export const validateInternalTrackingCodeFormat = (code: string) => trackingCodeGenerator.validateFormat(code);
export const checkInternalTrackingCodeUniqueness = (code: string) => trackingCodeGenerator.checkUniqueness(code);
export const normalizeInternalTrackingCode = (input: string) => trackingCodeGenerator.normalizeInternalTrackingCode(input);
export const sanitizeTrackingCodeForPublic = (code: string) => trackingCodeGenerator.sanitizeForPublicDisplay(code);

// Backward compatibility (deprecated - use internal tracking code functions)
export const generateTrackingCode = () => trackingCodeGenerator.generateInternalTrackingCode();
export const validateTrackingCodeFormat = (code: string) => trackingCodeGenerator.validateFormat(code);
export const checkTrackingCodeUniqueness = (code: string) => trackingCodeGenerator.checkUniqueness(code);
export const normalizeTrackingCode = (input: string) => trackingCodeGenerator.normalizeInternalTrackingCode(input);