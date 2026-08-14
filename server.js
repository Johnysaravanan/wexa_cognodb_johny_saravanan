require('dotenv').config();
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const URI = process.env.COGNO_URI;
const PASSWORD = process.env.COGNO_PASSWORD;

const driver = neo4j.driver(URI, neo4j.auth.basic('cognodb', PASSWORD));

app.post('/api/emergency-donors', async (req, res) => {
    const session = driver.session();
    
    try {
        const { hospitalName, bloodType } = req.body;
        
        // Single atomic transaction to avoid race conditions
        const result = await session.executeWrite(async tx => {
            const donorSearch = await tx.run(`
                // 1. Update the graph dynamically
                MATCH (h:Hospital {name: $hospitalName})
                OPTIONAL MATCH (h)-[oldRel:NEEDS_BLOOD]->()
                DELETE oldRel
                WITH h
                
                MATCH (targetType:BloodType {type: $bloodType})
                MERGE (h)-[:NEEDS_BLOOD]->(targetType)
                WITH h, targetType
                
                // 2. Perform the multi-hop search
                MATCH (h)-[:LOCATED_IN]->(r:Region)
                MATCH (targetType)<-[:CAN_DONATE_TO]-(compatibleType:BloodType)
                MATCH (d:Donor {is_available: true})-[:HAS_BLOOD_TYPE]->(compatibleType)
                MATCH (d)-[:LIVES_IN]->(r)
                
                // 3. Temporal logic rule (90 days)
                WHERE d.last_donated_date IS NULL 
                   OR duration.inDays(date(d.last_donated_date), date()).days > 90
                   
                // 4. Custom matching priority
                WITH d, compatibleType, r, targetType,
                     CASE compatibleType.type
                         WHEN targetType.type THEN 1 
                         WHEN 'O-' THEN 2            
                         WHEN 'O+' THEN 3
                         WHEN 'A-' THEN 4
                         WHEN 'A+' THEN 5
                         WHEN 'B-' THEN 6
                         WHEN 'B+' THEN 7
                         ELSE 8 
                     END AS matchPriority
                
                ORDER BY matchPriority ASC, d.last_donated_date ASC
                
                RETURN d.name AS name, 
                       d.phone AS phone, 
                       compatibleType.type AS bloodGroup, 
                       r.name AS region,
                       d.last_donated_date AS lastDonated
            `, { hospitalName, bloodType }); 
            
            return donorSearch.records;
        });

        const donors = result.map(record => ({
            name: record.get('name'),
            phone: record.get('phone'),
            bloodType: record.get('bloodGroup'),
            region: record.get('region'),
            lastDonated: record.get('lastDonated')
        }));

        res.json({ 
            success: true, 
            hospital: hospitalName,
            bloodNeeded: bloodType, 
            donorCount: donors.length, 
            data: donors 
        });

    } catch (error) {
        console.error("Database Query Failed:", error);
        res.status(500).json({ 
            success: false, 
            message: "Unable to reach the database or execute the query.",
            error: error.message 
        });
    } finally {
        await session.close();
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on('SIGINT', async () => {
    console.log("Shutting down gracefully...");
    await driver.close();
    process.exit(0);
});