require('dotenv').config();
const neo4j = require('neo4j-driver');

const URI = process.env.COGNO_URI;
const USER = 'cognodb';
const PASSWORD = process.env.COGNO_PASSWORD;

if (!URI || !PASSWORD) {
    console.error("Missing COGNO_URI or COGNO_PASSWORD in .env file.");
    process.exit(1);
}

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

const bloodCompatibilities = {
    "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A-", "A+", "AB-", "AB+"],
    "A+": ["A+", "AB+"],
    "B-": ["B-", "B+", "AB-", "AB+"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB-", "AB+"],
    "AB+": ["AB+"]
};

const regions = ["Mundakayam", "Kottayam", "Kuttikkanam", "Kottarakara"];

const hospitals = [
    { name: "Mundakayam Medical Trust", region: "Mundakayam", needs: "A+" },
    { name: "Kottayam General Hospital", region: "Kottayam", needs: "O-" }
];

// Helper to generate a random past date as YYYY-MM-DD
function getRandomPastDate(maxDaysAgo) {
    const daysAgo = Math.floor(Math.random() * maxDaysAgo);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
}

async function seedDatabase() {
    const session = driver.session();
    try {
        await session.executeWrite(async tx => {
            await tx.run("MATCH (n) DETACH DELETE n");

            console.log("Creating Blood Types and Compatibility relationships...");
            for (const [donorType, receivers] of Object.entries(bloodCompatibilities)) {
                await tx.run("MERGE (b:BloodType {type: $type})", { type: donorType });
                
                for (const receiverType of receivers) {
                    await tx.run(`
                        MERGE (d:BloodType {type: $donor})
                        MERGE (r:BloodType {type: $receiver})
                        MERGE (d)-[:CAN_DONATE_TO]->(r)
                    `, { donor: donorType, receiver: receiverType });
                }
            }

            console.log("Creating Regions...");
            for (const region of regions) {
                await tx.run("MERGE (r:Region {name: $name})", { name: region });
            }

            console.log("Creating Hospitals...");
            for (const hosp of hospitals) {
                await tx.run(`
                    MATCH (r:Region {name: $region})
                    MATCH (b:BloodType {type: $needs})
                    CREATE (h:Hospital {name: $name, emergency_level: 'High'})
                    CREATE (h)-[:LOCATED_IN]->(r)
                    CREATE (h)-[:NEEDS_BLOOD]->(b)
                `, hosp);
            }

            console.log("Generating 50 dummy donors with donation history...");
            const bloodTypesList = Object.keys(bloodCompatibilities);
            
            for (let i = 1; i <= 50; i++) {
                const b_type = bloodTypesList[Math.floor(Math.random() * bloodTypesList.length)];
                const region = regions[Math.floor(Math.random() * regions.length)];
                const is_available = Math.random() < 0.8; 
                const phone = `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`;
                
                // Assign a random last donation date between 10 and 200 days ago
                const last_donated_date = getRandomPastDate(200);

                await tx.run(`
                    MATCH (b:BloodType {type: $b_type})
                    MATCH (r:Region {name: $region})
                    CREATE (d:Donor {
                        name: $name, 
                        phone: $phone, 
                        is_available: $is_available,
                        last_donated_date: $last_donated_date
                    })
                    CREATE (d)-[:HAS_BLOOD_TYPE]->(b)
                    CREATE (d)-[:LIVES_IN]->(r)
                `, {
                    b_type, region, name: `Donor ${i}`, phone, is_available, last_donated_date
                });
            }
        });
        console.log("Seed data successfully loaded into CognoDB!");
    } catch (error) {
        console.error("Error seeding database:", error);
    } finally {
        await session.close();
        await driver.close();
    }
}

seedDatabase();