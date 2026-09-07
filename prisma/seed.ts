import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import argon2 from 'argon2';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({ accelerateUrl: process.env.DATABASE_URL });

async function main() {
  console.log('🌱 Starting VolunteerOps Enterprise Database Seed...');

  // Clean existing tables in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.dispatchJob.deleteMany();
  await prisma.telemetryPing.deleteMany();
  await prisma.contactSubmission.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.fieldReport.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.deployment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.volunteerSkill.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database tables.');

  // Password hash for demo users
  const defaultPasswordHash = await argon2.hash('changeme123');
  const adminPasswordHash = await argon2.hash('AdminPass@2026!');

  // 1. Seed Core Admins & Coordinators (Users)
  const usersData = [
    {
      email: 'admin@volunteerops.org',
      passwordHash: adminPasswordHash,
      fullName: 'Chief Operations Commander Alex Vance',
      role: 'SUPER_ADMIN',
      phoneNumber: '+1 (555) 019-9000',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
    {
      email: 'sarah.chen@fema.gov',
      passwordHash: defaultPasswordHash,
      fullName: 'Dr. Sarah Chen (FEMA Lead)',
      role: 'COORDINATOR',
      phoneNumber: '+1 (555) 019-9001',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    },
    {
      email: 'm.rodriguez@redcross.org',
      passwordHash: defaultPasswordHash,
      fullName: 'Michael Rodriguez (Logistics Chief)',
      role: 'COORDINATOR',
      phoneNumber: '+1 (555) 019-9002',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      email: 'emma.johnson@teamrubicon.org',
      passwordHash: defaultPasswordHash,
      fullName: 'Emma Johnson (Search & Rescue Lead)',
      role: 'TEAM_LEAD',
      phoneNumber: '+1 (555) 019-9003',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    },
    {
      email: 'david.park@unocha.org',
      passwordHash: defaultPasswordHash,
      fullName: 'David Park (UN OCHA Liaison)',
      role: 'COORDINATOR',
      phoneNumber: '+1 (555) 019-9004',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
    {
      email: 'tech@volunteerops.org',
      passwordHash: defaultPasswordHash,
      fullName: 'Marcus Brody (Lead Systems Architect)',
      role: 'SUPER_ADMIN',
      phoneNumber: '+1 (555) 019-9005',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    },
    {
      email: 'volunteer@volunteerops.org',
      passwordHash: defaultPasswordHash,
      fullName: 'Jane Doe (Field Medic)',
      role: 'VOLUNTEER',
      phoneNumber: '+1 (555) 123-4567',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    }
  ];

  const createdUsers = [];
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: u as any,
    });
    createdUsers.push(user);
  }

  console.log(`✅ Seeded ${createdUsers.length} system users.`);

  // 2. Seed Skills Catalog (40+ items across 6 categories)
  const skillsData = [
    // Medical
    { skillName: 'Emergency Medical Care', category: 'Medical', demandLevel: 'critical', description: 'Advanced emergency medical triage and field treatment.' },
    { skillName: 'Trauma Surgery & Critical Care', category: 'Medical', demandLevel: 'critical', description: 'Damage control surgery and severe trauma stabilization.' },
    { skillName: 'First Aid & CPR Certified', category: 'Medical', demandLevel: 'high', description: 'Basic life support and cardiopulmonary resuscitation.' },
    { skillName: 'Paramedic & ACLS', category: 'Medical', demandLevel: 'critical', description: 'Advanced Cardiac Life Support and pre-hospital emergency care.' },
    { skillName: 'Field Sanitation & Disease Control', category: 'Medical', demandLevel: 'medium', description: 'Epidemiological containment and field hygiene management.' },
    { skillName: 'Psychological First Aid', category: 'Medical', demandLevel: 'high', description: 'Mental health and crisis stress mitigation for survivors.' },
    { skillName: 'Pediatric Emergency Response', category: 'Medical', demandLevel: 'high', description: 'Specialized pediatric life support in disaster zones.' },
    { skillName: 'Pharmaceutical Inventory Triage', category: 'Medical', demandLevel: 'medium', description: 'Dispensing controlled medical relief supplies.' },

    // Search & Rescue
    { skillName: 'Urban Search & Rescue (USAR)', category: 'Search & Rescue', demandLevel: 'critical', description: 'Heavy structural collapse victim location and extraction.' },
    { skillName: 'Wilderness Tracking & Orienteering', category: 'Search & Rescue', demandLevel: 'high', description: 'Topographical navigation and missing person trailing.' },
    { skillName: 'K9 Search & Cadaver Detection', category: 'Search & Rescue', demandLevel: 'critical', description: 'Canine search operations in rubble and wilderness.' },
    { skillName: 'Swiftwater & Flood Rescue', category: 'Search & Rescue', demandLevel: 'critical', description: 'Boat handling and rescue operations in torrential floodwaters.' },
    { skillName: 'High-Angle Rope & Mountain Rescue', category: 'Search & Rescue', demandLevel: 'high', description: 'Technical rope rigging and vertical cliff evacuation.' },
    { skillName: 'Confined Space Extraction', category: 'Search & Rescue', demandLevel: 'high', description: 'Hazardous enclosed atmosphere entry and victim extraction.' },

    // Logistics & Heavy Operations
    { skillName: 'Supply Chain & Inventory Management', category: 'Logistics', demandLevel: 'high', description: 'Warehousing, manifesting, and mass supply distribution.' },
    { skillName: 'Heavy Equipment Operation (Excavator/Loader)', category: 'Logistics', demandLevel: 'critical', description: 'Clearing debris roads with bulldozers and hydraulic excavators.' },
    { skillName: 'Drone Reconnaissance & Thermal Mapping', category: 'Logistics', demandLevel: 'high', description: 'UAV aerial situational awareness and FLIR heat signature detection.' },
    { skillName: 'Commercial Truck Driving (CDL-A)', category: 'Logistics', demandLevel: 'high', description: 'Transporting bulk humanitarian relief cargo over hazardous roads.' },
    { skillName: 'HAZMAT & Chemical Spill Containment', category: 'Logistics', demandLevel: 'critical', description: 'Level-A hazmat mitigation and decontamination corridors.' },
    { skillName: 'Forklift & Pallet Staging', category: 'Logistics', demandLevel: 'medium', description: 'Rapid aircraft and cargo container offloading.' },
    { skillName: 'Aviation Airfield Marshalling', category: 'Logistics', demandLevel: 'medium', description: 'Helicopter LZ coordination and cargo sling operations.' },

    // Communications & Coordination
    { skillName: 'Emergency Radio & Satellite Comms (HAM/Sat)', category: 'Communications', demandLevel: 'high', description: 'Operating HF/VHF repeaters, Starlink, and BGAN satellite links.' },
    { skillName: 'Incident Command System (ICS-400)', category: 'Communications', demandLevel: 'critical', description: 'FEMA ICS operational dispatch and inter-agency coordination.' },
    { skillName: 'Multilingual Translation (Spanish/English)', category: 'Communications', demandLevel: 'high', description: 'Real-time Spanish emergency translation and victim intake.' },
    { skillName: 'Multilingual Translation (Arabic/English)', category: 'Communications', demandLevel: 'high', description: 'Arabic interpretation for displaced communities.' },
    { skillName: 'Multilingual Translation (French/Creole)', category: 'Communications', demandLevel: 'medium', description: 'French and Haitian Creole crisis translation.' },
    { skillName: 'Crisis Media & Public Information', category: 'Communications', demandLevel: 'medium', description: 'Emergency broadcast alerts and press briefing management.' },

    // Engineering & Infrastructure
    { skillName: 'Structural Integrity Assessment', category: 'Engineering', demandLevel: 'critical', description: 'Post-earthquake building safety tagging (Red/Yellow/Green).' },
    { skillName: 'Emergency Electrical Grid & High-Voltage Generators', category: 'Engineering', demandLevel: 'high', description: 'Restoring auxiliary power to field hospitals and shelters.' },
    { skillName: 'Water Purification & Reverse Osmosis', category: 'Engineering', demandLevel: 'critical', description: 'Deploying high-volume water filtration and testing units.' },
    { skillName: 'Bridge & Road Infrastructure Triage', category: 'Engineering', demandLevel: 'high', description: 'Assessing culverts, overpasses, and river crossings.' },
    { skillName: 'HVAC & Air Filtration Systems', category: 'Engineering', demandLevel: 'medium', description: 'Industrial ventilation in hazardous smoke and ash zones.' },

    // Fire & Protective Services
    { skillName: 'Wildland Firefighting & Cut-Lines', category: 'Firefighting', demandLevel: 'critical', description: 'Hotshot fire line construction and backburning operations.' },
    { skillName: 'Structural Fire Attack & Ventilation', category: 'Firefighting', demandLevel: 'high', description: 'Interior fire suppression and victim rescue.' },
    { skillName: 'Mass Evacuation Traffic Management', category: 'Firefighting', demandLevel: 'high', description: 'Corridor clearing and emergency traffic checkpoint control.' },
    { skillName: 'Shelter Security & Crowd Safety', category: 'Firefighting', demandLevel: 'medium', description: 'Perimeter protection and conflict de-escalation at shelters.' }
  ];

  const createdSkills = [];
  for (const s of skillsData) {
    const skill = await prisma.skill.create({ data: s });
    createdSkills.push(skill);
  }

  console.log(`✅ Seeded ${createdSkills.length} skills in catalog.`);

  // 3. Seed 15 Locations (Geocoded Disaster Zones & Forward Operating Bases)
  const locationsData = [
    { name: 'Northern District Command Hub - Zone A', address: '100 Golden Gate Ave', city: 'San Francisco', state: 'CA', country: 'USA', latitude: 37.774929, longitude: -122.419416, osmId: 101, hazardLevel: 'critical', radiusMeters: 15000 },
    { name: 'Central Valley Flood Relief Staging Area', address: '2500 Riverfront Way', city: 'Sacramento', state: 'CA', country: 'USA', latitude: 38.581572, longitude: -121.494400, osmId: 102, hazardLevel: 'high', radiusMeters: 25000 },
    { name: 'Gulf Coast Hurricane Logistics Base', address: '400 Port Blvd', city: 'Houston', state: 'TX', country: 'USA', latitude: 29.760427, longitude: -95.369803, osmId: 103, hazardLevel: 'critical', radiusMeters: 30000 },
    { name: 'South Florida Coastal Triage Center', address: '1200 Biscayne Blvd', city: 'Miami', state: 'FL', country: 'USA', latitude: 25.761680, longitude: -80.191790, osmId: 104, hazardLevel: 'high', radiusMeters: 12000 },
    { name: 'Rocky Mountain Alpine Rescue Base', address: '850 Mountain Pass Rd', city: 'Denver', state: 'CO', country: 'USA', latitude: 39.739236, longitude: -104.990251, osmId: 105, hazardLevel: 'medium', radiusMeters: 50000 },
    { name: 'Pacific Northwest Seismic Zone Bravo', address: '500 4th Ave', city: 'Seattle', state: 'WA', country: 'USA', latitude: 47.606209, longitude: -122.332071, osmId: 106, hazardLevel: 'high', radiusMeters: 20000 },
    { name: 'Mississippi Delta Flood Response Camp', address: '300 Canal St', city: 'New Orleans', state: 'LA', country: 'USA', latitude: 29.951065, longitude: -90.071533, osmId: 107, hazardLevel: 'critical', radiusMeters: 18000 },
    { name: 'Southern California Wildfire Perimeter Base', address: '1400 Foothill Blvd', city: 'Los Angeles', state: 'CA', country: 'USA', latitude: 34.052234, longitude: -118.243685, osmId: 108, hazardLevel: 'critical', radiusMeters: 40000 },
    { name: 'Great Lakes Air Logistics Warehouse', address: '1000 O Hare Way', city: 'Chicago', state: 'IL', country: 'USA', latitude: 41.878114, longitude: -87.629798, osmId: 109, hazardLevel: 'low', radiusMeters: 10000 },
    { name: 'Northeast Corridor Emergency Depot', address: '200 Broadway', city: 'New York', state: 'NY', country: 'USA', latitude: 40.712776, longitude: -74.005973, osmId: 110, hazardLevel: 'medium', radiusMeters: 8000 },
    { name: 'Desert Southwest Extreme Heat Triage', address: '300 Washington St', city: 'Phoenix', state: 'AZ', country: 'USA', latitude: 33.448377, longitude: -112.074037, osmId: 111, hazardLevel: 'high', radiusMeters: 25000 },
    { name: 'Pacific Rim Disaster Operations Hub', address: '900 Ala Moana Blvd', city: 'Honolulu', state: 'HI', country: 'USA', latitude: 21.306944, longitude: -157.858337, osmId: 112, hazardLevel: 'medium', radiusMeters: 35000 },
    { name: 'Arctic Perimeter Cold-Weather Depot', address: '100 5th Ave', city: 'Anchorage', state: 'AK', country: 'USA', latitude: 61.218056, longitude: -149.900278, osmId: 113, hazardLevel: 'high', radiusMeters: 60000 },
    { name: 'Caribbean Basin Forward Staging Site', address: '500 Calle Fortaleza', city: 'San Juan', state: 'PR', country: 'USA', latitude: 18.465539, longitude: -66.105735, osmId: 114, hazardLevel: 'critical', radiusMeters: 22000 },
    { name: 'Southeast Regional Command Center (FEMA IV)', address: '3000 Technology Pkwy', city: 'Atlanta', state: 'GA', country: 'USA', latitude: 33.748995, longitude: -84.387982, osmId: 115, hazardLevel: 'low', radiusMeters: 15000 }
  ];

  const createdLocations = [];
  for (const l of locationsData) {
    const loc = await prisma.location.create({ data: l });
    createdLocations.push(loc);
  }

  console.log(`✅ Seeded ${createdLocations.length} geocoded disaster locations.`);

  // 4. Seed 150+ Realistic Volunteers with diverse skills & geographical distribution
  const firstNames = ['Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Ava', 'Elijah', 'Sophia', 'Mateo', 'Isabella', 'Lucas', 'Mia', 'Henry', 'Evelyn', 'Alexander', 'Harper', 'Sebastian', 'Camila', 'Jack', 'Gianna', 'Daniel', 'Abigail', 'Matthew', 'Luna', 'Jackson', 'Ella', 'Samuel', 'Avery', 'David', 'Scarlett', 'Joseph', 'Emily', 'Carter', 'Aria', 'Owen', 'Penelope', 'Wyatt', 'Chloe', 'John', 'Layla', 'Jack', 'Mila', 'Luke', 'Nora', 'Jayden', 'Hazel', 'Dylan', 'Madison', 'Grayson', 'Ellie', 'Levi', 'Lily', 'Isaac', 'Nova', 'Gabriel', 'Isla', 'Julian', 'Grace', 'Anthony', 'Violet', 'Jaxon', 'Aurora', 'Lincoln', 'Riley', 'Joshua', 'Zoey', 'Christopher', 'Willow', 'Andrew', 'Emilia', 'Theodore', 'Stella', 'Caleb', 'Zoe', 'Ryan', 'Victoria', 'Asher', 'Hannah', 'Nathan', 'Lucy', 'Thomas', 'Elena', 'Leo', 'Lillian', 'Isaiah', 'Maya', 'Charles', 'Leah', 'Josiah', 'Paisley', 'Hudson', 'Addison', 'Christian', 'Natalie', 'Hunter', 'Eleanor', 'Connor', 'Claire', 'Eli', 'Skylar', 'Ezra', 'Samantha'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'];

  const channels = ['inbuilt', 'web_landing', 'red_cross_sync', 'fema_partner', 'sms_gateway'];
  const statuses = ['ACTIVE', 'AVAILABLE', 'DEPLOYED', 'AVAILABLE', 'AVAILABLE', 'ACTIVE', 'RESTRICTED', 'INACTIVE'];

  const createdVolunteers = [];

  // Create the special test volunteer linked to user id of Jane Doe
  const janeDoeUser = createdUsers.find(u => u.email === 'volunteer@volunteerops.org');
  const janeDoeVolunteer = await prisma.volunteer.create({
    data: {
      userId: janeDoeUser?.id,
      fullName: 'Jane Doe (Field Medic)',
      phoneNumber: '+1 (555) 123-4567',
      email: 'volunteer@volunteerops.org',
      registrationChannel: 'inbuilt',
      consentGiven: true,
      registrationDate: new Date('2024-01-10T08:00:00Z'),
      status: 'AVAILABLE',
      dateOfBirth: new Date('1990-05-15'),
      emergencyContact: 'Mark Doe (Spouse) - +1 (555) 987-6543',
      bio: 'Experienced trauma medical technician with 8+ years in emergency field response.',
      availabilitySchedule: { weekdays: true, weekends: true, overnight: true, noticeHours: 2 },
      address: '742 Evergreen Terrace, San Francisco, CA',
      latitude: 37.774929,
      longitude: -122.419416,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      totalHours: 142.50,
      badgeCount: 4,
    }
  });
  createdVolunteers.push(janeDoeVolunteer);

  for (let i = 1; i <= 150; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const fullName = `${fn} ${ln}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i}@volunteerops.net`;
    const locRef = createdLocations[i % createdLocations.length];
    
    // Add small random jitter to coordinates
    const latJitter = (Math.random() - 0.5) * 0.15;
    const lngJitter = (Math.random() - 0.5) * 0.15;
    const lat = Number(locRef.latitude) + latJitter;
    const lng = Number(locRef.longitude) + lngJitter;

    const status = statuses[i % statuses.length];
    const totalHours = Math.floor(Math.random() * 250) + 12;
    const badgeCount = Math.floor(Math.random() * 6);

    const v = await prisma.volunteer.create({
      data: {
        fullName,
        phoneNumber: `+1 (${Math.floor(Math.random() * 800) + 200}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        email,
        registrationChannel: channels[i % channels.length],
        consentGiven: true,
        registrationDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 3600 * 1000)),
        status: status as any,
        dateOfBirth: new Date(1975 + (i % 25), (i % 12), (i % 28) + 1),
        emergencyContact: `Emergency Contact for ${fn} - +1 (555) ${100 + i}-${1000 + i}`,
        bio: `Certified crisis field responder specialized in emergency support operations across ${locRef.city}.`,
        availabilitySchedule: {
          weekdays: i % 2 === 0,
          weekends: true,
          overnight: i % 3 === 0,
          noticeHours: (i % 4 + 1) * 2,
        },
        address: `${100 + i} ${ln} St, ${locRef.city}, ${locRef.state}`,
        latitude: lat,
        longitude: lng,
        avatarUrl: `https://images.unsplash.com/photo-${1500000000000 + (i * 1000000)}?w=150`,
        totalHours,
        badgeCount,
      }
    });
    createdVolunteers.push(v);
  }

  console.log(`✅ Seeded ${createdVolunteers.length} volunteer dossiers.`);

  // 5. Seed Volunteer Skills Linkages (assign 2-4 skills per volunteer with certifications)
  const proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
  let skillLinkCount = 0;

  for (const v of createdVolunteers) {
    const numSkills = 2 + (v.id % 3);
    const assignedSkillIds = new Set<number>();

    for (let s = 0; s < numSkills; s++) {
      const randomSkill = createdSkills[(v.id * 7 + s * 11) % createdSkills.length];
      if (!assignedSkillIds.has(randomSkill.id)) {
        assignedSkillIds.add(randomSkill.id);
        const isCertified = (v.id + s) % 2 === 0;
        await prisma.volunteerSkill.create({
          data: {
            volunteerId: v.id,
            skillId: randomSkill.id,
            proficiencyLevel: proficiencyLevels[(v.id + s) % proficiencyLevels.length],
            isCertified,
            certificationDate: isCertified ? new Date('2023-06-15') : null,
            certifiedBy: isCertified ? 'American Red Cross / FEMA ICS' : null,
          }
        });
        skillLinkCount++;
      }
    }
  }

  console.log(`✅ Seeded ${skillLinkCount} certified volunteer-skill qualifications.`);

  // 6. Seed 30+ Disaster Events & Crisis Missions
  const eventsData = [
    {
      eventName: 'Magnitude 7.1 Seismic Response - Bay Area',
      eventType: 'Earthquake',
      priority: 'CRITICAL',
      description: 'Major seismic strike along San Andreas Fault. Multiple collapsed structures, infrastructure fires, and mass casualty triage required.',
      startDate: new Date('2026-04-10T05:30:00Z'),
      endDate: new Date('2026-05-15T18:00:00Z'),
      locationId: createdLocations[0].id,
      status: 'ACTIVE',
      requiredVolunteers: 80,
      coordinatorName: 'Chief Alex Vance',
      coordinatorId: createdUsers[0].id,
      requiredSkills: ['Emergency Medical Care', 'Urban Search & Rescue (USAR)', 'Structural Integrity Assessment'],
      tags: ['SEISMIC', 'MASS_CASUALTY', 'RED_ALERT'],
    },
    {
      eventName: 'Sacramento River Basin Flood Evacuation',
      eventType: 'Flood',
      priority: 'HIGH',
      description: 'Severe levee breach causing rapid flooding of residential sectors. Swiftwater extraction, shelter management, and supply delivery underway.',
      startDate: new Date('2026-04-12T08:00:00Z'),
      endDate: new Date('2026-05-01T20:00:00Z'),
      locationId: createdLocations[1].id,
      status: 'ACTIVE',
      requiredVolunteers: 45,
      coordinatorName: 'Michael Rodriguez',
      coordinatorId: createdUsers[2].id,
      requiredSkills: ['Swiftwater & Flood Rescue', 'Supply Chain & Inventory Management', 'Commercial Truck Driving (CDL-A)'],
      tags: ['FLOOD', 'EVACUATION', 'LOGISTICS'],
    },
    {
      eventName: 'Category 4 Hurricane Zephyr Landfall - Gulf Coast',
      eventType: 'Hurricane',
      priority: 'CRITICAL',
      description: 'Storm surge reaching 14 feet. Massive coastal inundation, high-voltage grid collapse, and emergency shelter operations needed for 20,000 evacuees.',
      startDate: new Date('2026-04-14T02:00:00Z'),
      endDate: new Date('2026-05-20T12:00:00Z'),
      locationId: createdLocations[2].id,
      status: 'ACTIVE',
      requiredVolunteers: 120,
      coordinatorName: 'Dr. Sarah Chen',
      coordinatorId: createdUsers[1].id,
      requiredSkills: ['Paramedic & ACLS', 'Water Purification & Reverse Osmosis', 'Emergency Radio & Satellite Comms (HAM/Sat)'],
      tags: ['HURRICANE', 'STORM_SURGE', 'CRITICAL_INFRASTRUCTURE'],
    },
    {
      eventName: 'Pacific Northwest Cascadia Subduction Exercise',
      eventType: 'Disaster Simulation',
      priority: 'MEDIUM',
      description: 'Full-scale multi-agency disaster preparedness exercise testing satellite comms, mass casualty triage, and supply airlift routing.',
      startDate: new Date('2026-05-01T09:00:00Z'),
      endDate: new Date('2026-05-03T17:00:00Z'),
      locationId: createdLocations[5].id,
      status: 'STAGED',
      requiredVolunteers: 35,
      coordinatorName: 'Emma Johnson',
      coordinatorId: createdUsers[3].id,
      requiredSkills: ['Incident Command System (ICS-400)', 'Emergency Radio & Satellite Comms (HAM/Sat)'],
      tags: ['TRAINING', 'DRILL', 'SIMULATION'],
    },
    {
      eventName: 'Sierra Nevada Wilderness Wildfire Containment',
      eventType: 'Wildfire',
      priority: 'HIGH',
      description: 'Fast-moving blaze across 45,000 acres. Fire break construction, civilian evacuation corridors, and smoke inhalation triage.',
      startDate: new Date('2026-04-05T14:00:00Z'),
      endDate: new Date('2026-04-28T22:00:00Z'),
      locationId: createdLocations[7].id,
      status: 'CONTAINED',
      requiredVolunteers: 60,
      coordinatorName: 'Emma Johnson',
      coordinatorId: createdUsers[3].id,
      requiredSkills: ['Wildland Firefighting & Cut-Lines', 'Drone Reconnaissance & Thermal Mapping'],
      tags: ['WILDFIRE', 'EVACUATION', 'AIR_QUALITY'],
    },
    {
      eventName: 'Mississippi Delta Flood Relief - Phase 1',
      eventType: 'Flood',
      priority: 'MEDIUM',
      description: 'Completed immediate water rescue operations. Shifted to community recovery, mobile clinic operations, and food distribution.',
      startDate: new Date('2026-03-01T08:00:00Z'),
      endDate: new Date('2026-04-01T18:00:00Z'),
      locationId: createdLocations[6].id,
      status: 'COMPLETED',
      requiredVolunteers: 50,
      coordinatorName: 'Michael Rodriguez',
      coordinatorId: createdUsers[2].id,
      requiredSkills: ['First Aid & CPR Certified', 'Field Sanitation & Disease Control'],
      tags: ['FLOOD_RELIEF', 'RECOVERY', 'COMPLETED'],
    }
  ];

  // Add more procedural events to reach 25+ events
  for (let e = 7; e <= 25; e++) {
    const loc = createdLocations[e % createdLocations.length];
    const types = ['Earthquake Relief', 'Flash Flood Assistance', 'Heatwave Emergency Shelter', 'Severe Storm Damage Response', 'Industrial Hazmat Support', 'Mass Casualty Triage Drill'];
    const p = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'][e % 4];
    const st = ['ACTIVE', 'STAGED', 'CONTAINED', 'COMPLETED'][e % 4];

    eventsData.push({
      eventName: `${types[e % types.length]} - Sector ${e}`,
      eventType: types[e % types.length],
      priority: p as any,
      description: `Operational disaster response deployment focusing on rapid humanitarian relief, infrastructure triage, and volunteer dispatch in ${loc.city}.`,
      startDate: new Date(Date.now() - (e * 3 * 24 * 3600 * 1000)),
      endDate: new Date(Date.now() + (e * 5 * 24 * 3600 * 1000)),
      locationId: loc.id,
      status: st as any,
      requiredVolunteers: 20 + (e % 30),
      coordinatorName: 'Dr. Sarah Chen',
      coordinatorId: createdUsers[1].id,
      requiredSkills: ['Emergency Medical Care', 'Supply Chain & Inventory Management'],
      tags: ['OPERATIONAL', 'COMMUNITY_RELIEF'],
    });
  }

  const createdEvents = [];
  for (const ed of eventsData) {
    const ev = await prisma.event.create({ data: ed as any });
    createdEvents.push(ev);
  }

  console.log(`✅ Seeded ${createdEvents.length} crisis missions and events.`);

  // 7. Seed 250+ Mission Deployments with check-in timestamps and GPS coordinates
  const deploymentStatuses = ['CHECKED_IN', 'ON_SITE', 'EN_ROUTE', 'ASSIGNED', 'COMPLETED'];
  const checkInMethods = ['GPS_GEOFENCE', 'QR_CODE', 'MANUAL_DISPATCH', 'SMS_CONFIRM'];
  const createdDeployments = [];

  for (let d = 0; d < 250; d++) {
    const volunteer = createdVolunteers[d % createdVolunteers.length];
    const event = createdEvents[d % createdEvents.length];
    const status = deploymentStatuses[d % deploymentStatuses.length];
    const assignedTime = new Date(Date.now() - (d * 12 * 3600 * 1000));
    const isCheckedIn = status === 'CHECKED_IN' || status === 'ON_SITE' || status === 'COMPLETED';

    const dep = await prisma.deployment.create({
      data: {
        volunteerId: volunteer.id,
        eventId: event.id,
        assignedBy: createdUsers[d % 3].id,
        assignedAt: assignedTime,
        checkInTime: isCheckedIn ? new Date(assignedTime.getTime() + 45 * 60 * 1000) : null,
        checkInLatitude: isCheckedIn ? volunteer.latitude : null,
        checkInLongitude: isCheckedIn ? volunteer.longitude : null,
        checkInMethod: isCheckedIn ? checkInMethods[d % checkInMethods.length] : null,
        completedAt: status === 'COMPLETED' ? new Date(assignedTime.getTime() + 8 * 3600 * 1000) : null,
        status: status as any,
        notes: `Assigned to Sector ${(d % 5) + 1} for crisis response operations.`,
      }
    });
    createdDeployments.push(dep);
  }

  console.log(`✅ Seeded ${createdDeployments.length} mission deployments.`);

  // 8. Seed 200+ Field Reports (Damage assessment, triage notes, supply needs)
  const reportTypes = ['DAMAGE_ASSESSMENT', 'MEDICAL_TRIAGE', 'SUPPLY_REQUEST', 'HAZARD_ALERT', 'GENERAL_UPDATE'];
  const reportTexts = [
    'Triage station established at northern entrance. 14 patients treated for lacerations and smoke inhalation. Medical oxygen bottles running low.',
    'Residential block 4 assessed. Structural collapse in secondary annex; search completed with no trapped victims. Green tagged front section.',
    'Urgent supply replenishment needed: 500 blankets, 200 cases of potable water, 50 infant formula units requested for shelter overflow.',
    'Exposed high-voltage downed powerline on Elm Street. Road blocked. Fire engine crew requested for isolation.',
    'Water purification unit running at 1,200 gallons/hour. Clean water distribution queue orderly. 400 families served.',
    'Evacuation convoy Alpha arrived at secondary shelter. 85 displaced residents checked in with red cross team.',
    'FLIR drone scan completed over sector 7. Detected 2 heat signatures in basement area; USAR team redirected for extrication.'
  ];

  for (let r = 0; r < 200; r++) {
    const dep = createdDeployments[r % createdDeployments.length];
    const rType = reportTypes[r % reportTypes.length];
    const rText = reportTexts[r % reportTexts.length];

    await prisma.fieldReport.create({
      data: {
        deploymentId: dep.id,
        reportTime: new Date(Date.now() - (r * 6 * 3600 * 1000)),
        reportType: rType,
        priority: (r % 3 === 0 ? 'critical' : r % 2 === 0 ? 'high' : 'medium'),
        textResponse: rText,
        mediaUrl: r % 2 === 0 ? `https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600` : null,
        latitude: dep.checkInLatitude,
        longitude: dep.checkInLongitude,
        submittedVia: r % 3 === 0 ? 'mobile_ios' : 'mobile_android',
        status: r % 4 === 0 ? 'verified' : 'submitted',
        verifiedBy: r % 4 === 0 ? 'Dr. Sarah Chen (FEMA)' : null,
      }
    });
  }

  console.log('✅ Seeded 200+ incident field reports.');

  // 9. Seed 400+ Tactical Communications & Broadcast Alerts
  const channelsList = ['alerts', 'teams', 'general', 'coordination', 'medical_alpha', 'logistics_bravo'];
  const tacticalMessages = [
    { sender: 'Chief Alex Vance', role: 'SUPER_ADMIN', text: 'All units: Code Red alert declared for Sector 1. Prioritize immediate evacuation of zone B.', priority: 'critical', channel: 'alerts' },
    { sender: 'Dr. Sarah Chen', role: 'COORDINATOR', text: 'Medical Alpha triage is operational at Grid 44-B. Send all walk-in triage cases here.', priority: 'high', channel: 'medical_alpha' },
    { sender: 'Michael Rodriguez', role: 'COORDINATOR', text: 'Convoy 3 with water purification filters has cleared highway 101. ETA 20 minutes.', priority: 'normal', channel: 'logistics_bravo' },
    { sender: 'Emma Johnson', role: 'TEAM_LEAD', text: 'Search Team Charlie has extracted 3 survivors from building 12. Transporting to medical.', priority: 'high', channel: 'teams' },
    { sender: 'David Park', role: 'COORDINATOR', text: 'Weather radar indicates incoming severe rain in 2 hours. Secure outdoor supply caches.', priority: 'high', channel: 'coordination' },
    { sender: 'Jane Doe', role: 'VOLUNTEER', text: 'First aid station 2 restocked. Awaiting next ambulance arrival.', priority: 'normal', channel: 'general' }
  ];

  for (let c = 0; c < 400; c++) {
    const tm = tacticalMessages[c % tacticalMessages.length];
    const event = createdEvents[c % createdEvents.length];
    await prisma.communication.create({
      data: {
        eventId: event.id,
        channelId: tm.channel,
        senderId: createdUsers[c % createdUsers.length].id,
        senderName: tm.sender,
        senderRole: tm.role,
        message: `[${c + 1}] ${tm.text}`,
        priority: tm.priority,
        messageType: tm.channel === 'alerts' ? 'alert' : 'text',
        createdAt: new Date(Date.now() - (400 - c) * 15 * 60 * 1000),
      }
    });
  }

  console.log('✅ Seeded 400+ tactical communication messages.');

  // 10. Seed Notifications
  for (let n = 0; n < 150; n++) {
    const volunteer = createdVolunteers[n % createdVolunteers.length];
    const event = createdEvents[n % createdEvents.length];
    await prisma.notification.create({
      data: {
        volunteerId: volunteer.id,
        eventId: event.id,
        notificationType: n % 3 === 0 ? 'MISSION_ASSIGNMENT' : n % 2 === 0 ? 'BROADCAST_ALERT' : 'CHECKIN_REMINDER',
        priority: n % 4 === 0 ? 'critical' : 'normal',
        title: n % 3 === 0 ? 'New Mission Dispatch' : 'Emergency Operational Alert',
        message: `You have been deployed to ${event.eventName}. Please review deployment parameters and verify your GPS check-in.`,
        sentAt: new Date(Date.now() - n * 3600 * 1000),
        sentBy: createdUsers[0].id,
        status: n % 3 === 0 ? 'delivered' : 'sent',
        readAt: n % 2 === 0 ? new Date() : null,
      }
    });
  }

  console.log('✅ Seeded 150+ notifications.');

  // 11. Seed 150+ Feedback & After-Action Reviews
  const feedbackComments = [
    'Outstanding on-site leadership and rapid medical response. Coordinated flawlessly with FEMA units.',
    'Clear communication channels and good equipment availability. Very organized shift.',
    'Logistics convoy arrived on schedule. Well-executed field operations.',
    'Search & rescue operations ran smoothly despite rough terrain. Great team coordination.',
    'Excellent medical triage staging. Felt supported throughout the 12-hour operational window.'
  ];

  for (let f = 0; f < 150; f++) {
    const dep = createdDeployments[f % createdDeployments.length];
    await prisma.feedback.create({
      data: {
        volunteerId: dep.volunteerId,
        deploymentId: dep.id,
        eventId: dep.eventId,
        feedbackTime: new Date(Date.now() - f * 4 * 3600 * 1000),
        rating: 4 + (f % 2),
        comments: feedbackComments[f % feedbackComments.length],
        submittedVia: 'mobile_app',
      }
    });
  }

  console.log('✅ Seeded 150+ feedback reviews.');

  // 12. Seed 50+ Landing Site Contact Submissions
  const contactInquiries = [
    { name: 'Director Marcus Vance', email: 'mvance@salvationarmy.org', organization: 'Salvation Army Crisis Relief', subject: 'Integration of regional volunteer roster', type: 'partnership', message: 'We would like to connect our 5,000 regional disaster responders to the VolunteerOps real-time dispatch API.' },
    { name: 'Dr. Elena Rostova', email: 'elena.rostova@doctorswithoutborders.org', organization: 'Doctors Without Borders', subject: 'Medical credential verification pipeline', type: 'partnership', message: 'Inquiring about API access for rapid verification of field trauma surgical qualifications during hurricane deployments.' },
    { name: 'Reporter Sarah Jenkins', email: 'sjenkins@reuters.com', organization: 'Reuters International', subject: 'Press inquiry on earthquake coordination telemetry', type: 'press', message: 'Requesting an interview with your Chief Systems Architect on latency reduction during the recent Cascadia earthquake response.' },
    { name: 'Captain James Miller', email: 'jmiller@cityfire.gov', organization: 'Metro Fire & Rescue', subject: 'Mutual aid dispatch integration', type: 'tech_support', message: 'Looking for documentation on webhooks for automated dispatch of mutual aid units during wildland fires.' },
    { name: 'Carlos Morales', email: 'carlos.m@gmail.com', organization: null, subject: 'Joining emergency drone reconnaissance unit', type: 'volunteer_inquiry', message: 'I am an FAA Part 107 certified commercial drone pilot with thermal imaging equipment ready to deploy.' }
  ];

  for (let k = 0; k < 50; k++) {
    const inq = contactInquiries[k % contactInquiries.length];
    const statuses = ['NEW', 'IN_REVIEW', 'RESPONDED', 'RESOLVED'];
    await prisma.contactSubmission.create({
      data: {
        name: `${inq.name} #${k + 1}`,
        email: `contact.${k + 1}@${inq.email.split('@')[1]}`,
        organization: inq.organization,
        subject: inq.subject,
        message: inq.message,
        inquiryType: inq.type,
        status: statuses[k % statuses.length] as any,
        responseNotes: k % 3 === 0 ? 'Assigned to coordinator for immediate outreach.' : null,
        ipAddress: `192.168.1.${10 + (k % 200)}`,
        createdAt: new Date(Date.now() - k * 8 * 3600 * 1000),
      }
    });
  }

  console.log('✅ Seeded 50+ landing site contact submissions.');

  // 13. Seed Telemetry Pings & Live Responder Fleet GPS
  for (let t = 0; t < 100; t++) {
    const volunteer = createdVolunteers[t % createdVolunteers.length];
    if (volunteer.latitude && volunteer.longitude) {
      await prisma.telemetryPing.create({
        data: {
          volunteerId: volunteer.id,
          latitude: volunteer.latitude,
          longitude: volunteer.longitude,
          altitude: 45.2,
          batteryLevel: 85 - (t % 50),
          speed: 12.5,
          heading: (t * 35) % 360,
          isDistress: t === 99, // One test SOS beacon
          recordedAt: new Date(Date.now() - t * 60 * 1000),
        }
      });
    }
  }

  console.log('✅ Seeded live responder telemetry pings.');

  // 14. Seed Initial Dispatch Queue Jobs & Audit Logs
  await prisma.dispatchJob.createMany({
    data: [
      { jobType: 'AUTO_DISPATCH_MISSION', payload: { eventId: createdEvents[0].id, priority: 'CRITICAL', requiredSkills: ['Emergency Medical Care'] }, priority: 20, status: 'PENDING' },
      { jobType: 'BROADCAST_ALERT', payload: { title: 'Code Red Flood Warning', message: 'Sacramento river cresting in 30 minutes.' }, priority: 15, status: 'PENDING' },
      { jobType: 'ANALYTICS_ROLLUP', payload: { interval: 'hourly' }, priority: 5, status: 'COMPLETED' },
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: createdUsers[0].id, action: 'SYSTEM_BOOTSTRAP', entityType: 'SYSTEM', entityId: 1, ipAddress: '127.0.0.1', userAgent: 'VolunteerOps-Engine/2.0' },
      { userId: createdUsers[1].id, action: 'MISSION_DISPATCH', entityType: 'Event', entityId: createdEvents[0].id, ipAddress: '10.0.0.1', userAgent: 'VolunteerOps-Admin/Web' },
    ]
  });

  console.log('🎉 Enterprise Database Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
