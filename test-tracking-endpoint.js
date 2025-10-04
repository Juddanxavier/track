/** @format */

// Simple test to verify the tracking endpoint functionality
// This can be run manually to test the API

const testTrackingEndpoint = async () => {
    console.log('Testing tracking endpoint...');
    
    // Test with invalid tracking code
    try {
        const response = await fetch('http://localhost:3000/api/tracking/invalid');
        const data = await response.json();
        console.log('Invalid tracking code test:', {
            status: response.status,
            data
        });
    } catch (error) {
        console.log('Error testing invalid tracking code:', error.message);
    }
    
    // Test with valid format but non-existent tracking code
    try {
        const response = await fetch('http://localhost:3000/api/tracking/SC123456789');
        const data = await response.json();
        console.log('Non-existent tracking code test:', {
            status: response.status,
            data
        });
    } catch (error) {
        console.log('Error testing non-existent tracking code:', error.message);
    }
};

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testTrackingEndpoint };
} else {
    console.log('Test functions ready. Call testTrackingEndpoint() to run tests.');
}