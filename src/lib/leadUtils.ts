/** @format */

import type { Lead } from '@/types/lead';

// Status badge styling and display logic
export const getStatusBadgeVariant = (status: Lead['status']) => {
    switch (status) {
        case 'new':
            return 'secondary'; // Gray
        case 'contacted':
            return 'default'; // Primary blue
        case 'failed':
            return 'destructive'; // Red
        case 'success':
            return 'default'; // Primary (we'll use custom styling for green)
        case 'converted':
            return 'outline'; // Outline
        default:
            return 'secondary';
    }
};

export const getStatusDisplayText = (status: Lead['status']) => {
    switch (status) {
        case 'new':
            return 'New';
        case 'contacted':
            return 'Contacted';
        case 'failed':
            return 'Failed';
        case 'success':
            return 'Success';
        case 'converted':
            return 'Converted';
        default:
            return status;
    }
};

export const getStatusIcon = (status: Lead['status']) => {
    switch (status) {
        case 'new':
            return '🆕';
        case 'contacted':
            return '📞';
        case 'failed':
            return '❌';
        case 'success':
            return '✅';
        case 'converted':
            return '🚚';
        default:
            return '❓';
    }
};

// Country selection utilities and validation
export const COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'AT', name: 'Austria' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'AU', name: 'Australia' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'CN', name: 'China' },
    { code: 'IN', name: 'India' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'EG', name: 'Egypt' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'KE', name: 'Kenya' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'IL', name: 'Israel' },
    { code: 'TR', name: 'Turkey' },
    { code: 'RU', name: 'Russia' },
    { code: 'PL', name: 'Poland' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'HU', name: 'Hungary' },
    { code: 'RO', name: 'Romania' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'HR', name: 'Croatia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LV', name: 'Latvia' },
    { code: 'EE', name: 'Estonia' },
    { code: 'IE', name: 'Ireland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'GR', name: 'Greece' },
    { code: 'CY', name: 'Cyprus' },
    { code: 'MT', name: 'Malta' },
    { code: 'LU', name: 'Luxembourg' },
] as const;

export const getCountryName = (countryCode: string): string => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    return country ? country.name : countryCode;
};

export const isValidCountryCode = (countryCode: string): boolean => {
    return COUNTRIES.some(c => c.code === countryCode);
};

export const getCountryOptions = () => {
    return COUNTRIES.map(country => ({
        value: country.code,
        label: country.name,
    }));
};

// Weight formatting and validation helpers
export const WEIGHT_UNITS = [
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'lbs', label: 'Pounds (lbs)' },
    { value: 'g', label: 'Grams (g)' },
    { value: 'oz', label: 'Ounces (oz)' },
    { value: 'tons', label: 'Tons' },
] as const;

export const parseWeight = (weightString: string): { value: number; unit: string } | null => {
    if (!weightString || typeof weightString !== 'string') {
        return null;
    }

    // Try to extract number and unit from string like "25 kg" or "25kg"
    const match = weightString.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);

    if (!match) {
        return null;
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'kg'; // Default to kg if no unit specified

    if (isNaN(value) || value <= 0) {
        return null;
    }

    return { value, unit };
};

export const formatWeight = (value: number, unit: string): string => {
    if (isNaN(value) || value <= 0) {
        return '';
    }

    return `${value} ${unit}`;
};

export const isValidWeight = (weightString: string): boolean => {
    const parsed = parseWeight(weightString);
    return parsed !== null && parsed.value > 0;
};

export const normalizeWeight = (weightString: string): string => {
    const parsed = parseWeight(weightString);
    if (!parsed) {
        return weightString;
    }

    return formatWeight(parsed.value, parsed.unit);
};

// Convert weight between units (basic conversion)
export const convertWeight = (
    value: number,
    fromUnit: string,
    toUnit: string
): number => {
    if (fromUnit === toUnit) {
        return value;
    }

    // Convert to grams first (base unit)
    let grams: number;
    switch (fromUnit.toLowerCase()) {
        case 'kg':
            grams = value * 1000;
            break;
        case 'lbs':
            grams = value * 453.592;
            break;
        case 'g':
            grams = value;
            break;
        case 'oz':
            grams = value * 28.3495;
            break;
        case 'tons':
            grams = value * 1000000;
            break;
        default:
            return value; // Unknown unit, return as-is
    }

    // Convert from grams to target unit
    switch (toUnit.toLowerCase()) {
        case 'kg':
            return grams / 1000;
        case 'lbs':
            return grams / 453.592;
        case 'g':
            return grams;
        case 'oz':
            return grams / 28.3495;
        case 'tons':
            return grams / 1000000;
        default:
            return grams; // Unknown unit, return grams
    }
};

// Lead status validation and transitions
export const getValidStatusTransitions = (currentStatus: Lead['status']): Lead['status'][] => {
    switch (currentStatus) {
        case 'new':
            return ['contacted', 'failed'];
        case 'contacted':
            return ['failed', 'success'];
        case 'failed':
            return ['contacted']; // Allow retry
        case 'success':
            return ['converted'];
        case 'converted':
            return []; // Terminal state
        default:
            return [];
    }
};

export const canTransitionToStatus = (
    currentStatus: Lead['status'],
    newStatus: Lead['status']
): boolean => {
    const validTransitions = getValidStatusTransitions(currentStatus);
    return validTransitions.includes(newStatus);
};

export const isStatusRequiresReason = (status: Lead['status']): boolean => {
    return status === 'failed';
};

export const canConvertLead = (lead: Lead): boolean => {
    return lead.status === 'success' && !lead.shipmentId;
};

// Lead display utilities
export const getLeadDisplayName = (lead: Lead): string => {
    return lead.customerName || lead.customerEmail || 'Unknown Customer';
};

export const getLeadRoute = (lead: Lead): string => {
    const origin = getCountryName(lead.originCountry);
    const destination = getCountryName(lead.destinationCountry);
    return `${origin} → ${destination}`;
};

export const formatLeadCreatedDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const getLeadAge = (createdAt: Date | string): string => {
    const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return '1 day ago';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else {
        const months = Math.floor(diffDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    }
};

// Customer relationship management utilities
export const getCustomerDisplayInfo = (lead: Lead): {
    name: string;
    email: string;
    phone?: string;
    isLinked: boolean;
    linkedCustomerInfo?: string;
} => {
    const isLinked = !!lead.customerId && !!lead.linkedCustomer;

    return {
        name: lead.customerName,
        email: lead.customerEmail,
        phone: lead.customerPhone || undefined,
        isLinked,
        linkedCustomerInfo: isLinked && lead.linkedCustomer
            ? `${lead.linkedCustomer.name} (${lead.linkedCustomer.role || 'customer'})`
            : undefined,
    };
};

export const shouldSyncCustomerData = (lead: Lead): boolean => {
    // Check if lead has a linked customer but the data might be out of sync
    if (!lead.customerId || !lead.linkedCustomer) {
        return false;
    }

    // Check if customer data in lead differs from linked customer
    const customerDataDiffers =
        lead.customerName !== lead.linkedCustomer.name ||
        lead.customerEmail !== lead.linkedCustomer.email ||
        (lead.customerPhone || '') !== (lead.linkedCustomer.phone || '');

    return customerDataDiffers;
};

export const getCustomerSyncSuggestion = (lead: Lead): {
    shouldSync: boolean;
    differences: string[];
    suggestedAction: 'update_lead' | 'update_customer' | 'unlink' | 'none';
} => {
    if (!shouldSyncCustomerData(lead)) {
        return {
            shouldSync: false,
            differences: [],
            suggestedAction: 'none',
        };
    }

    const differences: string[] = [];

    if (lead.customerName !== lead.linkedCustomer!.name) {
        differences.push(`Name: "${lead.customerName}" vs "${lead.linkedCustomer!.name}"`);
    }

    if (lead.customerEmail !== lead.linkedCustomer!.email) {
        differences.push(`Email: "${lead.customerEmail}" vs "${lead.linkedCustomer!.email}"`);
    }

    if ((lead.customerPhone || '') !== (lead.linkedCustomer!.phone || '')) {
        differences.push(`Phone: "${lead.customerPhone || 'none'}" vs "${lead.linkedCustomer!.phone || 'none'}"`);
    }

    // Suggest updating lead data to match customer (customer data is usually more authoritative)
    return {
        shouldSync: true,
        differences,
        suggestedAction: 'update_lead',
    };
};

export const validateCustomerLinkage = (lead: Lead): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
} => {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if customerId is set but linkedCustomer is missing (data integrity issue)
    if (lead.customerId && !lead.linkedCustomer) {
        issues.push('Lead has customerId but no linked customer data');
        recommendations.push('Verify customer exists or remove customerId');
    }

    // Check if customer data seems to be manually entered when a customer link exists
    if (lead.customerId && lead.linkedCustomer) {
        const syncSuggestion = getCustomerSyncSuggestion(lead);
        if (syncSuggestion.shouldSync) {
            issues.push('Customer data in lead differs from linked customer');
            recommendations.push('Sync lead data with customer record or unlink customer');
        }
    }

    // Check for potential duplicate customers (same email)
    if (!lead.customerId && lead.customerEmail) {
        recommendations.push('Check if a customer with this email already exists');
    }

    return {
        isValid: issues.length === 0,
        issues,
        recommendations,
    };
};

export const formatCustomerRelationshipStatus = (lead: Lead): {
    status: 'linked' | 'manual' | 'sync_needed' | 'invalid';
    displayText: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
} => {
    if (!lead.customerId) {
        return {
            status: 'manual',
            displayText: 'Manual Entry',
            badgeVariant: 'secondary',
        };
    }

    if (!lead.linkedCustomer) {
        return {
            status: 'invalid',
            displayText: 'Invalid Link',
            badgeVariant: 'destructive',
        };
    }

    if (shouldSyncCustomerData(lead)) {
        return {
            status: 'sync_needed',
            displayText: 'Sync Needed',
            badgeVariant: 'outline',
        };
    }

    return {
        status: 'linked',
        displayText: 'Linked Customer',
        badgeVariant: 'default',
    };
};