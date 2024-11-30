const { app, output } = require('@azure/functions');
const fetch = require('node-fetch'); // Use require instead of import

const { MongoClient } = require('mongodb'); // MongoDB Node.js driver

// MongoDB connection details
const mongoUri = process.env['MONGO_CONNECTION_STRING']; // MongoDB connection string
const dbName = 'myDatabase'; // MongoDB database name
const collectionName = 'fetchedData'; // MongoDB collection name

app.timer('timerTrigger1', {
    schedule: '0 */1 * * * *', // Trigger every minute
    return: output.storageQueue({
        connection: 'storage_APPSETTING', // Connection string for Azure Storage Account (optional)
        queueName: 'your-queue-name'      // The name of the Azure Storage Queue (optional)
    }),
    handler: async (myTimer, context) => {
        // Get the current timestamp
        const currentTime = new Date().toISOString();
        
        // Define the URL from which we fetch data, including the timestamp as a query parameter
        const url = `https://jsonplaceholder.typicode.com/posts?timestamp=${currentTime}`; // JSONPlaceholder API

        try {
            // Fetch data from the URL
            const response = await fetch(url);
            
            // Check if the response is ok (status code 200-299)
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.statusText}`);
            }

            // Log the raw response body for debugging
            const responseBody = await response.text();
            context.log('Raw response body:', responseBody);

            // Try to parse the response body as JSON
            let data = {};
            try {
                data = JSON.parse(responseBody);
            } catch (jsonError) {
                throw new Error(`Failed to parse JSON: ${jsonError.message}`);
            }

            // Prepare the data to be inserted into MongoDB
            const document = {
                timestamp: currentTime,  // Include the timestamp
                data: data               // Include the fetched data
            };

            // Connect to MongoDB and insert the data
            const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
            await client.connect();
            const db = client.db(dbName);
            const collection = db.collection(collectionName);

            // Insert the document into the MongoDB collection
            const insertResult = await collection.insertOne(document);
            context.log('Data inserted into MongoDB:', insertResult);

            // Return a message indicating success
            const queueMessage = {
                time: currentTime, // Include the timestamp
                data: data         // Include the fetched data
            };

            // Optionally, return a message to be inserted into the Azure Storage Queue (if needed)
            return queueMessage;
        } catch (error) {
            // Log the error if something goes wrong
            context.log('Error fetching or inserting data into MongoDB:', error);
            
            // Return an error message (optional)
            return { error: `Failed to fetch or insert data into MongoDB: ${error.message}` };
        }
    }
});

