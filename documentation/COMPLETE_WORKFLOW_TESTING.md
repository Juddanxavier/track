# Complete Lead-to-Shipment-to-Delivery Workflow Testing Guide

This document provides comprehensive testing instructions for the complete shipment management workflow, from lead conversion to delivery tracking.

## Prerequisites

1. **Application Running**: Ensure the Next.js application is running on `http://localhost:3000`
2. **Admin Access**: You need admin user credentials to access shipment management features
3. **Database**: Ensure the database is properly configured and migrations are applied

## Manual Testing Workflow

### 1. Lead Creation and Management

#### Step 1.1: Create a Test Lead
1. Navigate to `/admin/leads`
2. Click "Add New Lead"
3. Fill in the form with test data:
   ```
   Customer Name: John Doe
   Email: john.doe@example.com
   Phone: +1234567890
   Origin Country: United States
   Destination Country: Canada
   Weight: 5kg
   Package Type: Box
   ```
4. Save the lead
5. **Verify**: Lead appears in the leads list with "Success" status

#### Step 1.2: Validate Lead Data
1. Click on the created lead to view details
2. **Verify**: All entered information is displayed correctly
3. **Verify**: Lead has no associated shipment yet

### 2. Lead to Shipment Conversion

#### Step 2.1: Convert Lead to Shipment
1. From the leads list, click "Convert to Shipment" for the test lead
2. Fill in additional shipment information:
   ```
   Courier: FedEx
   Courier Tracking Number: FDX123456789
   Package Description: Test Package
   Origin Address:
     - Name: Test Sender
     - Address: 123 Main St
     - City: New York
     - State: NY
     - Postal Code: 10001
     - Country: United States
   
   Destination Address:
     - Name: John Doe
     - Address: 456 Oak Ave
     - City: Toronto
     - State: ON
     - Postal Code: M5V 3A8
     - Country: Canada
   
   Estimated Delivery: [7 days from now]
   ```
3. Submit the conversion
4. **Verify**: Success notification appears
5. **Verify**: Lead status changes to "Converted to Shipment"

#### Step 2.2: Validate Shipment Creation
1. Navigate to `/admin/shipments`
2. **Verify**: New shipment appears in the list
3. **Verify**: Shipment has a white-label tracking code (format: SC + 9 digits)
4. **Verify**: Shipment status is "Pending"
5. **Verify**: Customer information matches the original lead

### 3. Shipment Management

#### Step 3.1: View Shipment Details
1. Click on the created shipment to view details
2. **Verify**: All shipment information is displayed correctly
3. **Verify**: Event history shows initial "Shipment created" event
4. **Verify**: Lead reference is shown (if converted from lead)

#### Step 3.2: Manual Status Updates
1. In shipment details, click "Update Status"
2. Update status to "In Transit" with notes: "Package picked up by courier"
3. **Verify**: Status updates successfully
4. **Verify**: New event appears in event history
5. Repeat for "Out for Delivery" and "Delivered" statuses

#### Step 3.3: Test Shipment Filtering and Search
1. Return to shipments list
2. Test filters:
   - Filter by status (Pending, In Transit, Delivered)
   - Filter by courier (FedEx, UPS, etc.)
   - Search by tracking code
   - Search by customer name
3. **Verify**: Filtering works correctly
4. **Verify**: Search returns expected results

### 4. Public Tracking Interface

#### Step 4.1: Test Public Tracking Page
1. Copy the shipment's tracking code
2. Navigate to `/tracking/[trackingCode]` (replace with actual tracking code)
3. **Verify**: Tracking information is displayed
4. **Verify**: Customer sees sanitized information (no internal details)
5. **Verify**: Event history is shown in chronological order

#### Step 4.2: Test Public Tracking API
1. Use curl or Postman to test the public API:
   ```bash
   curl http://localhost:3000/api/tracking/[trackingCode]
   ```
2. **Verify**: API returns tracking information
3. **Verify**: Response includes status, events, and estimated delivery
4. **Verify**: No sensitive internal data is exposed

### 5. Navigation and Stats

#### Step 5.1: Test Navigation Menu
1. Check the admin sidebar navigation
2. **Verify**: "Shipments" menu item is present under Admin section
3. **Verify**: Badge shows pending shipment count (if any pending shipments exist)
4. **Verify**: Badge shows exception count (if any exception shipments exist)

#### Step 5.2: Test Shipment Statistics
1. Navigate to `/admin/shipments`
2. **Verify**: Dashboard shows shipment statistics
3. **Verify**: Stats include total, pending, in-transit, delivered, exception counts
4. **Verify**: Recent shipments count is accurate

### 6. API Integration Testing

#### Step 6.1: Test Shipment Creation API
```bash
curl -X POST http://localhost:3000/api/shipments \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Jane Smith",
    "customerEmail": "jane.smith@example.com",
    "packageDescription": "API Test Package",
    "courier": "UPS",
    "originAddress": {
      "name": "API Sender",
      "addressLine1": "789 API St",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94105",
      "country": "United States"
    },
    "destinationAddress": {
      "name": "Jane Smith",
      "addressLine1": "321 Test Ave",
      "city": "Vancouver",
      "state": "BC",
      "postalCode": "V6B 1A1",
      "country": "Canada"
    }
  }'
```

#### Step 6.2: Test Shipment Status Update API
```bash
curl -X PUT http://localhost:3000/api/shipments/[shipmentId]/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in-transit",
    "notes": "API status update test"
  }'
```

#### Step 6.3: Test Shipments List API
```bash
curl "http://localhost:3000/api/shipments?page=1&perPage=10&status=pending"
```

### 7. Notification System Integration

#### Step 7.1: Test Shipment Notifications
1. Update a shipment status
2. **Verify**: Notification appears in the notification bell
3. **Verify**: Notification contains shipment information
4. **Verify**: Notification links to shipment details

#### Step 7.2: Test Notification Preferences
1. Navigate to notification preferences
2. **Verify**: Shipment-related notification types are available
3. **Verify**: Users can opt-in/out of shipment notifications

### 8. Error Handling and Edge Cases

#### Step 8.1: Test Invalid Tracking Codes
1. Try accessing `/tracking/INVALID123`
2. **Verify**: Appropriate error message is displayed
3. **Verify**: No system errors occur

#### Step 8.2: Test Duplicate Lead Conversion
1. Try to convert the same lead to shipment again
2. **Verify**: Error message prevents duplicate conversion
3. **Verify**: Original shipment remains unchanged

#### Step 8.3: Test Invalid Status Transitions
1. Try to update a delivered shipment back to pending
2. **Verify**: System prevents invalid status transitions
3. **Verify**: Appropriate error message is shown

### 9. Performance and Load Testing

#### Step 9.1: Test with Multiple Shipments
1. Create 20+ test shipments
2. **Verify**: List page loads quickly
3. **Verify**: Pagination works correctly
4. **Verify**: Filtering remains responsive

#### Step 9.2: Test Concurrent Operations
1. Open multiple browser tabs
2. Perform simultaneous shipment operations
3. **Verify**: No data corruption occurs
4. **Verify**: All operations complete successfully

## Automated Testing

### Running the API Test Suite
```bash
# Run the API workflow test
npx tsx scripts/test-api-workflow.ts
```

### Running the Complete Workflow Test
```bash
# Run the complete database workflow test
npx tsx scripts/test-complete-workflow.ts
```

## Expected Results

### Success Criteria
- ✅ All manual test steps complete without errors
- ✅ API endpoints return expected responses
- ✅ Data integrity is maintained throughout the workflow
- ✅ Notifications are delivered correctly
- ✅ Public tracking interface works properly
- ✅ Navigation and stats display correctly

### Performance Criteria
- ✅ Page load times under 2 seconds
- ✅ API response times under 500ms
- ✅ No memory leaks during extended use
- ✅ Proper error handling for all edge cases

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify database is running
   - Check connection string in `.env`
   - Ensure migrations are applied

2. **Authentication Errors**
   - Verify admin user exists
   - Check session configuration
   - Ensure proper role assignments

3. **API Errors**
   - Check server logs for detailed error messages
   - Verify request format and headers
   - Ensure proper authentication tokens

4. **Tracking Code Issues**
   - Verify tracking code format (SC + 9 digits)
   - Check for uniqueness constraints
   - Ensure proper generation logic

## Reporting Issues

When reporting issues, please include:
1. Steps to reproduce the problem
2. Expected vs actual behavior
3. Browser/environment information
4. Console error messages
5. Network request/response details

## Conclusion

This comprehensive testing guide ensures that the complete lead-to-shipment-to-delivery workflow functions correctly across all components of the system. Regular execution of these tests helps maintain system reliability and user experience quality.