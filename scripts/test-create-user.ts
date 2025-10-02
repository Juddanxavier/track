/** @format */

async function testCreateUser() {
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        country: 'Test Country',
        zipCode: '12345',
        role: 'customer',
        sendWelcomeEmail: false,
    };

    try {
        const response = await fetch('http://localhost:3000/api/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testUser),
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ User created successfully:', result);
        } else {
            console.error('❌ Failed to create user:', result);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testCreateUser();