require('dotenv').config();
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Securely load connection details
const URI = process.env.COGNO_URI;
const PASSWORD = process.env.COGNO_PASSWORD;

// Initialize the driver
const driver = neo4j.driver(URI, neo4j.auth.basic('cognodb', PASSWORD));

/**
 * GET /api/emergency-donors/:hospitalName
 * The Multi-Hop Traversal Endpoint
 * Finds available donors in the same region as the hospital who have compatible blood.
 */
app.get('/api/emergency-donors/:hospitalName', async (req, res) => {
    // Open a new session for this request
    const session = driver.session();
    
    try {
        const hospitalName = req.params.hospitalName;
        
        // Use executeRead for read-only queries (best practice)
        const result = await session.executeRead(async tx => {
            return await tx.run(`
                MATCH (h:Hospital {name: $hospitalName})-[:LOCATED_IN]->(r:Region)
                MATCH (h)-[:NEEDS_BLOOD]->(targetType:BloodType)
                MATCH (targetType)<-[:CAN_DONATE_TO]-(compatibleType:BloodType)
                MATCH (d:Donor {is_available: true})-[:HAS_BLOOD_TYPE]->(compatibleType)
                MATCH (d)-[:LIVES_IN]->(r)
                RETURN d.name AS name, d.phone AS phone, compatibleType.type AS bloodType, r.name AS region, targetType.type as needs
            `, { hospitalName }); // Parameterized query to prevent injection
        });

        // Format the graph records into standard JSON for the frontend
        const donors = result.records.map(record => ({
            name: record.get('name'),
            phone: record.get('phone'),
            bloodType: record.get('bloodType'),
            region: record.get('region')
        }));
        
        const needs = result.records.length > 0 ? result.records[0].get('needs') : "Unknown";

        res.json({ 
            success: true, 
            hospital: hospitalName,
            bloodNeeded: needs,
            donorCount: donors.length, 
            data: donors 
        });

    } catch (error) {
        console.error("Database Query Failed:", error);
        
        // Graceful error handling (Assessment Requirement)
        res.status(500).json({ 
            success: false, 
            message: "Unable to reach the database or execute the query. Please try again later.",
            error: error.message 
        });
    } finally {
        // Always close the session to prevent connection leaks
        await session.close();
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown of the Neo4j driver when closing the app
process.on('SIGINT', async () => {
    console.log("Shutting down gracefully...");
    await driver.close();
    process.exit(0);
});