import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Organization (MOC-aligned)
  const org = await prisma.organization.upsert({
    where: { crNumber: "1010342981" },
    update: {
      nameArabic: "شركة معماري للتطوير العقاري",
      nameEnglish: "Mimaric Real Estate Development Co.",
      tradeNameArabic: "معماري",
      tradeNameEnglish: "Mimaric",
      entityType: "COMPANY",
      legalForm: "LIMITED_LIABILITY_COMPANY",
      registrationStatus: "ACTIVE_REG",
      registrationDate: new Date("2020-03-15"),
      expiryDate: new Date("2028-03-14"),
      capitalAmountSar: 5000000,
      mainActivityCode: "411001",
      mainActivityNameAr: "التطوير العقاري",
      contactInfo: {
        mobileNumber: "0551234567",
        phoneNumber: "0112345678",
        email: "info@mimaric.sa",
        websiteUrl: "https://mimaric.sa",
      },
      nationalAddress: {
        region: "منطقة الرياض",
        city: "الرياض",
        district: "العليا",
        streetName: "طريق الملك فهد",
        buildingNumber: "2345",
        postalCode: "12211",
        additionalNumber: "8765",
        shortAddress: "RRAA2345",
      },
      managerInfo: {
        managerName: "عمر الغامدي",
        managerId: "1098765432",
        managerRole: "المدير العام",
      },
    },
    create: {
      name: "Mimaric Development",
      nameArabic: "شركة معماري للتطوير العقاري",
      nameEnglish: "Mimaric Real Estate Development Co.",
      tradeNameArabic: "معماري",
      tradeNameEnglish: "Mimaric",
      crNumber: "1010342981",
      unifiedNumber: "7001234567",
      vatNumber: "310452938100003",
      type: "DEVELOPER",
      entityType: "COMPANY",
      legalForm: "LIMITED_LIABILITY_COMPANY",
      registrationStatus: "ACTIVE_REG",
      registrationDate: new Date("2020-03-15"),
      expiryDate: new Date("2028-03-14"),
      capitalAmountSar: 5000000,
      mainActivityCode: "411001",
      mainActivityNameAr: "التطوير العقاري",
      contactInfo: {
        mobileNumber: "0551234567",
        phoneNumber: "0112345678",
        email: "info@mimaric.sa",
        websiteUrl: "https://mimaric.sa",
      },
      nationalAddress: {
        region: "منطقة الرياض",
        city: "الرياض",
        district: "العليا",
        streetName: "طريق الملك فهد",
        buildingNumber: "2345",
        postalCode: "12211",
        additionalNumber: "8765",
        shortAddress: "RRAA2345",
      },
      managerInfo: {
        managerName: "عمر الغامدي",
        managerId: "1098765432",
        managerRole: "المدير العام",
      },
    },
  });
  console.log("Organization:", org.name);

  // 2. Company Admin User (customer admin test account)
  const hashedPassword = await bcrypt.hash("mimaric2026", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@mimaric.sa" },
    update: { password: hashedPassword, role: "ADMIN" },
    create: {
      email: "admin@mimaric.sa",
      name: "Omar Al-Ghamdi",
      password: hashedPassword,
      role: "ADMIN",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
    },
  });
  console.log("Company Admin user:", admin.email);

  // 3. Team members
  const salesPassword = await bcrypt.hash("sales2026", 12);
  const financePassword = await bcrypt.hash("finance2026", 12);

  await prisma.user.upsert({
    where: { email: "ahmed@mimaric.sa" },
    update: {},
    create: {
      email: "ahmed@mimaric.sa",
      name: "Ahmed Al-Harbi",
      password: salesPassword,
      role: "AGENT",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
    },
  });

  await prisma.user.upsert({
    where: { email: "fatima@mimaric.sa" },
    update: {},
    create: {
      email: "fatima@mimaric.sa",
      name: "Fatima Al-Rashid",
      password: financePassword,
      role: "MANAGER",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
    },
  });

  await prisma.user.upsert({
    where: { email: "khalid@mimaric.sa" },
    update: {},
    create: {
      email: "khalid@mimaric.sa",
      name: "Khalid Al-Otaibi",
      password: salesPassword,
      role: "TECHNICIAN",
      organizationId: org.id,
      onboardingCompleted: true,
      accountType: "company",
    },
  });

  // 3b. Additional role users (one per role for access testing)
  const testPassword = await bcrypt.hash("mimaric2026", 12);

  await prisma.user.upsert({
    where: { email: "dev_admin@mimaric.sa" },
    update: { role: "SYSTEM_SUPPORT", organizationId: null },
    create: { email: "dev_admin@mimaric.sa", name: "Saeed Al-Anzi", password: testPassword, role: "SYSTEM_SUPPORT", organizationId: null, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "pm@mimaric.sa" },
    update: {},
    create: { email: "pm@mimaric.sa", name: "Nasser Al-Zahrani", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "sales_mgr@mimaric.sa" },
    update: {},
    create: { email: "sales_mgr@mimaric.sa", name: "Huda Al-Maliki", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "property_mgr@mimaric.sa" },
    update: {},
    create: { email: "property_mgr@mimaric.sa", name: "Maryam Al-Subaie", password: testPassword, role: "MANAGER", organizationId: org.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "buyer@mimaric.sa" },
    update: {},
    create: { email: "buyer@mimaric.sa", name: "Turki Al-Fadhli", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "tenant@mimaric.sa" },
    update: {},
    create: { email: "tenant@mimaric.sa", name: "Reem Al-Harthy", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "user@mimaric.sa" },
    update: {},
    create: { email: "user@mimaric.sa", name: "Lama Al-Jaber", password: testPassword, role: "USER", organizationId: org.id, onboardingCompleted: true, accountType: "company" },
  });
  // System Admin — Mimaric platform admin (for testing system-level ticket management)
  await prisma.user.upsert({
    where: { email: "system@mimaric.sa" },
    update: { role: "SYSTEM_ADMIN", organizationId: null },
    create: { email: "system@mimaric.sa", name: "Mimaric System Admin", password: testPassword, role: "SYSTEM_ADMIN", organizationId: null, onboardingCompleted: true, accountType: "company" },
  });
  // System Support — Mimaric support/engineering team
  await prisma.user.upsert({
    where: { email: "support@mimaric.sa" },
    update: { role: "SYSTEM_SUPPORT", organizationId: null },
    create: { email: "support@mimaric.sa", name: "Mimaric Support Agent", password: testPassword, role: "SYSTEM_SUPPORT", organizationId: null, onboardingCompleted: true, accountType: "company" },
  });
  console.log("Created 9 role test users (7 operational + 2 system)");

  // 4. Projects (Balady-aligned)
  const project1 = await prisma.project.create({
    data: {
      name: "Al Arjuan Towers",
      description: "أبراج سكنية فاخرة في شمال الرياض",
      type: "RESIDENTIAL",
      status: "UNDER_CONSTRUCTION",
      organizationId: org.id,
      parcelNumber: "P-2458-17",
      plotNumber: "117",
      blockNumber: "B12",
      deedNumber: "DEED-1445-998877",
      landUse: "RESIDENTIAL_LAND",
      totalAreaSqm: 4500,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "الملقا",
      streetName: "طريق أنس بن مالك",
      postalCode: "13521",
      latitude: 24.7942,
      longitude: 46.6265,
      boundaries: {
        north: "شارع 12 متر",
        south: "قطعة مجاورة 2459",
        east: "ممر خدمي",
        west: "قطعة مجاورة 2457",
      },
      utilities: {
        electricityConnected: true,
        waterConnected: true,
        sewageConnected: true,
        roadAccess: true,
      },
      estimatedValueSar: 45000000,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "Horizon Business Park",
      description: "مجمع تجاري حديث في منطقة كافد",
      type: "COMMERCIAL",
      status: "PLANNING",
      organizationId: org.id,
      parcelNumber: "P-3102-08",
      deedNumber: "DEED-1446-112233",
      landUse: "COMMERCIAL_LAND",
      totalAreaSqm: 8200,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "حطين",
      latitude: 24.7636,
      longitude: 46.6534,
      utilities: {
        electricityConnected: true,
        waterConnected: true,
        sewageConnected: false,
        roadAccess: true,
      },
      estimatedValueSar: 82000000,
    },
  });

  // 4b. Land Parcels (Projects with LAND_* statuses)
  await prisma.project.create({
    data: {
      name: "أرض حي الياسمين",
      description: "أرض سكنية في حي الياسمين شمال الرياض بمساحة كبيرة مناسبة لمجمع سكني",
      type: "RESIDENTIAL",
      status: "LAND_ACQUIRED",
      organizationId: org.id,
      parcelNumber: "P-5520-03",
      plotNumber: "42",
      blockNumber: "B7",
      deedNumber: "DEED-1446-554433",
      landUse: "RESIDENTIAL_LAND",
      totalAreaSqm: 6200,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "الياسمين",
      streetName: "شارع الأمير محمد بن سلمان",
      postalCode: "13325",
      latitude: 24.8231,
      longitude: 46.6018,
      estimatedValueSar: 31000000,
      landOwner: "صالح بن عبدالله العتيبي",
      landOwnerType: "INDIVIDUAL",
      acquisitionPrice: 28500000,
      acquisitionDate: new Date("2025-11-20"),
    },
  });

  await prisma.project.create({
    data: {
      name: "أرض طريق الملك سلمان التجارية",
      description: "أرض تجارية على طريق الملك سلمان مناسبة لمجمع مكاتب أو مركز تجاري",
      type: "COMMERCIAL",
      status: "LAND_UNDER_REVIEW",
      organizationId: org.id,
      parcelNumber: "P-7801-15",
      deedNumber: "DEED-1447-887766",
      landUse: "COMMERCIAL_LAND",
      totalAreaSqm: 12500,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "العارض",
      streetName: "طريق الملك سلمان",
      postalCode: "13336",
      latitude: 24.8456,
      longitude: 46.6342,
      estimatedValueSar: 95000000,
      landOwner: "شركة الوطنية للاستثمار العقاري",
      landOwnerType: "COMPANY",
    },
  });

  await prisma.project.create({
    data: {
      name: "أرض حي النرجس",
      description: "أرض سكنية في حي النرجس مناسبة لبناء فلل",
      type: "VILLA_COMPOUND",
      status: "LAND_IDENTIFIED",
      organizationId: org.id,
      parcelNumber: "P-9102-22",
      deedNumber: "DEED-1447-223344",
      landUse: "RESIDENTIAL_LAND",
      totalAreaSqm: 8700,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "النرجس",
      latitude: 24.8102,
      longitude: 46.6189,
      estimatedValueSar: 52000000,
      landOwner: "عبدالرحمن بن محمد الشمري",
      landOwnerType: "INDIVIDUAL",
    },
  });

  await prisma.project.create({
    data: {
      name: "أرض مخطط الخير",
      description: "أرض متعددة الاستخدام في مخطط الخير شمال الرياض",
      type: "MIXED_USE",
      status: "LAND_ACQUIRED",
      organizationId: org.id,
      parcelNumber: "P-6340-09",
      plotNumber: "88",
      blockNumber: "B15",
      deedNumber: "DEED-1446-667788",
      landUse: "MIXED_USE_LAND",
      totalAreaSqm: 15000,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "الخير",
      streetName: "طريق الأمير فيصل بن بندر",
      postalCode: "13341",
      latitude: 24.8675,
      longitude: 46.5890,
      estimatedValueSar: 75000000,
      landOwner: "مؤسسة الراجحي الخيرية",
      landOwnerType: "COMPANY",
      acquisitionPrice: 70000000,
      acquisitionDate: new Date("2025-09-10"),
    },
  });

  await prisma.project.create({
    data: {
      name: "أرض حي الرمال",
      description: "أرض صناعية في حي الرمال شرق الرياض قرب المنطقة الصناعية",
      type: "COMMERCIAL",
      status: "LAND_UNDER_REVIEW",
      organizationId: org.id,
      parcelNumber: "P-4210-31",
      deedNumber: "DEED-1447-112299",
      landUse: "INDUSTRIAL_LAND",
      totalAreaSqm: 22000,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "الرمال",
      latitude: 24.7340,
      longitude: 46.8120,
      estimatedValueSar: 44000000,
      landOwner: "شركة المدار للتطوير",
      landOwnerType: "COMPANY",
    },
  });

  console.log("Created 5 land parcels");

  // 5. Buildings (Balady building details)
  const building1 = await prisma.building.create({
    data: {
      name: "Tower A",
      projectId: project1.id,
      numberOfFloors: 15,
      buildingAreaSqm: 1800,
      constructionYear: 1445,
      buildingType: "residential",
      occupancyStatus: "partially_occupied",
      electricityConnected: true,
      waterConnected: true,
    },
  });
  const building2 = await prisma.building.create({
    data: {
      name: "Tower B",
      projectId: project1.id,
      numberOfFloors: 12,
      buildingAreaSqm: 1500,
      constructionYear: 1445,
      buildingType: "residential",
      occupancyStatus: "under_construction",
      electricityConnected: true,
      waterConnected: true,
    },
  });
  const building3 = await prisma.building.create({
    data: {
      name: "Block 1",
      projectId: project2.id,
      numberOfFloors: 5,
      buildingAreaSqm: 2200,
      buildingType: "commercial",
      occupancyStatus: "vacant",
    },
  });
  const building4 = await prisma.building.create({
    data: {
      name: "Block 2",
      projectId: project2.id,
      numberOfFloors: 3,
      buildingAreaSqm: 3000,
      buildingType: "commercial",
      occupancyStatus: "vacant",
    },
  });

  // 6. Units — with floor, bedrooms, bathrooms
  const unitData = [
    // Tower A — apartments
    { number: "A-101", type: "APARTMENT" as const, buildingId: building1.id, area: 120, price: 850000, status: "AVAILABLE" as const, floor: 1, bedrooms: 3, bathrooms: 2 },
    { number: "A-102", type: "APARTMENT" as const, buildingId: building1.id, area: 95, price: 720000, status: "SOLD" as const, floor: 1, bedrooms: 2, bathrooms: 2 },
    { number: "A-201", type: "APARTMENT" as const, buildingId: building1.id, area: 140, price: 980000, status: "RESERVED" as const, floor: 2, bedrooms: 3, bathrooms: 3 },
    // Tower B — apartments + villa
    { number: "B-101", type: "APARTMENT" as const, buildingId: building2.id, area: 110, price: 800000, status: "AVAILABLE" as const, floor: 1, bedrooms: 2, bathrooms: 2 },
    { number: "B-102", type: "APARTMENT" as const, buildingId: building2.id, area: 160, price: 1100000, status: "RENTED" as const, floor: 1, bedrooms: 4, bathrooms: 3 },
    { number: "B-201", type: "VILLA" as const, buildingId: building2.id, area: 320, price: 2500000, status: "AVAILABLE" as const, floor: 1, bedrooms: 5, bathrooms: 4 },
    // Block 1 — offices
    { number: "C1-01", type: "OFFICE" as const, buildingId: building3.id, area: 80, price: 450000, status: "AVAILABLE" as const, floor: 1 },
    { number: "C1-02", type: "OFFICE" as const, buildingId: building3.id, area: 120, price: 680000, status: "RESERVED" as const, floor: 2 },
    { number: "C1-03", type: "RETAIL" as const, buildingId: building3.id, area: 200, price: 1200000, status: "AVAILABLE" as const, floor: 0 },
    // Block 2 — retail + warehouse
    { number: "C2-01", type: "RETAIL" as const, buildingId: building4.id, area: 150, price: 900000, status: "AVAILABLE" as const, floor: 0 },
    { number: "C2-02", type: "WAREHOUSE" as const, buildingId: building4.id, area: 500, price: 1800000, status: "SOLD" as const, floor: 0 },
    { number: "C2-03", type: "OFFICE" as const, buildingId: building4.id, area: 90, price: 520000, status: "RENTED" as const, floor: 1 },
  ];

  for (const unit of unitData) {
    await prisma.unit.create({ data: unit });
  }
  console.log("Created 12 units across 4 buildings");

  // 7. Customers (Absher-aligned)
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Mohammed Al-Qahtani",
        nameArabic: "محمد عبدالله القحطاني",
        phone: "0501234567",
        email: "m.qahtani@gmail.com",
        nationalId: "1023456789",
        personType: "SAUDI_CITIZEN",
        gender: "MALE",
        dateOfBirth: new Date("1985-03-14"),
        nationality: "سعودي",
        nationalityCode: "SA",
        address: {
          region: "منطقة الرياض",
          city: "الرياض",
          district: "النرجس",
          streetName: "شارع الأمير سلطان",
          buildingNumber: "4567",
          postalCode: "13434",
        },
        documentInfo: {
          documentType: "national_id",
          documentNumber: "1023456789",
          issueDate: "2020-01-10",
          expiryDate: "2030-01-09",
          issuingAuthority: "الأحوال المدنية",
        },
        status: "QUALIFIED",
        source: "Website",
        organizationId: org.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Noura Al-Dosari",
        nameArabic: "نورة سعد الدوسري",
        phone: "0559876543",
        email: "noura.d@outlook.com",
        nationalId: "1034567890",
        personType: "SAUDI_CITIZEN",
        gender: "FEMALE",
        dateOfBirth: new Date("1992-07-22"),
        nationality: "سعودية",
        nationalityCode: "SA",
        status: "VIEWING",
        source: "Referral",
        organizationId: org.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Abdullah Al-Shehri",
        nameArabic: "عبدالله محمد الشهري",
        phone: "0541112233",
        email: "a.shehri@yahoo.com",
        nationalId: "1045678901",
        personType: "SAUDI_CITIZEN",
        gender: "MALE",
        nationality: "سعودي",
        nationalityCode: "SA",
        status: "NEW",
        source: "Exhibition",
        organizationId: org.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Sara Al-Mutairi",
        nameArabic: "سارة خالد المطيري",
        phone: "0567778899",
        nationalId: "1056789012",
        personType: "SAUDI_CITIZEN",
        gender: "FEMALE",
        status: "INTERESTED",
        source: "Social Media",
        organizationId: org.id,
      },
    }),
    prisma.customer.create({
      data: {
        name: "Fahad Al-Tamimi",
        nameArabic: "فهد عبدالرحمن التميمي",
        phone: "0523334455",
        email: "tenant@mimaric.sa",
        nationalId: "2087654321",
        personType: "RESIDENT",
        gender: "MALE",
        dateOfBirth: new Date("1988-11-05"),
        nationality: "أردني",
        nationalityCode: "JO",
        address: {
          region: "منطقة الرياض",
          city: "الرياض",
          district: "الملقا",
          buildingNumber: "1234",
          postalCode: "13521",
        },
        documentInfo: {
          documentType: "iqama",
          documentNumber: "2087654321",
          issueDate: "2023-06-15",
          expiryDate: "2026-06-14",
          issuingAuthority: "الجوازات",
        },
        status: "ACTIVE_TENANT",
        source: "Walk-in",
        organizationId: org.id,
      },
    }),
  ]);
  console.log("Created 5 customers with Absher-aligned data");

  // 8. A sample lease with installments (Fahad as active tenant)
  const rentedUnit = await prisma.unit.findFirst({ where: { number: "B-102" } });
  if (rentedUnit) {
    const lease = await prisma.lease.create({
      data: {
        unitId: rentedUnit.id,
        customerId: customers[4]!.id,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        totalAmount: 48000,
        status: "ACTIVE",
      },
    });

    for (let i = 0; i < 12; i++) {
      const dueDate = new Date(2025, i, 1);
      const isPast = dueDate < new Date();
      await prisma.rentInstallment.create({
        data: {
          leaseId: lease.id,
          dueDate,
          amount: 4000,
          status: isPast ? "PAID" : "UNPAID",
          paidAt: isPast ? new Date(2025, i, 3) : null,
          paymentMethod: isPast ? "Bank Transfer" : null,
        },
      });
    }
    console.log("Created lease with 12 installments for Fahad");
  }

  // 9. Sample maintenance requests
  const units = await prisma.unit.findMany({ take: 3 });
  if (units.length >= 3) {
    await prisma.maintenanceRequest.create({
      data: {
        title: "تسريب مياه في الحمام",
        description: "يوجد تسريب مياه من السقف في الحمام الرئيسي",
        type: "plumbing",
        status: "OPEN",
        priority: "HIGH",
        unitId: units[0]!.id,
        organizationId: org.id,
      },
    });
    await prisma.maintenanceRequest.create({
      data: {
        title: "عطل في التكييف",
        description: "التكييف لا يعمل في غرفة المعيشة",
        type: "hvac",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        unitId: units[1]!.id,
        organizationId: org.id,
      },
    });
    await prisma.maintenanceRequest.create({
      data: {
        title: "مشكلة كهربائية",
        description: "انقطاع متكرر للكهرباء في المطبخ",
        type: "electrical",
        status: "RESOLVED",
        priority: "URGENT",
        unitId: units[2]!.id,
        organizationId: org.id,
        resolvedAt: new Date("2025-02-15"),
      },
    });
    console.log("Created 3 maintenance requests");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DUMMY ORG — Separate tenant for E2E testing & demo
  // ═══════════════════════════════════════════════════════════════════════════

  const dummyOrg = await prisma.organization.upsert({
    where: { crNumber: "2050678901" },
    update: {},
    create: {
      name: "Dummy Development Co.",
      nameArabic: "شركة التطوير التجريبية",
      nameEnglish: "Dummy Development Co.",
      tradeNameArabic: "تجريبية",
      tradeNameEnglish: "DummyCo",
      crNumber: "2050678901",
      unifiedNumber: "7009876543",
      vatNumber: "310987654300003",
      type: "DEVELOPER",
      entityType: "COMPANY",
      legalForm: "LIMITED_LIABILITY_COMPANY",
      registrationStatus: "ACTIVE_REG",
      registrationDate: new Date("2022-01-10"),
      expiryDate: new Date("2030-01-09"),
      capitalAmountSar: 2000000,
      mainActivityCode: "411001",
      mainActivityNameAr: "التطوير العقاري",
      contactInfo: { mobileNumber: "0559999888", email: "info@dummy.sa" },
      nationalAddress: { region: "منطقة الرياض", city: "الرياض", district: "الورود", postalCode: "12252" },
    },
  });
  console.log("Dummy Org:", dummyOrg.name);

  // Dummy Org users (4 roles)
  const dummyPw = await bcrypt.hash("mimaric2026", 12);

  await prisma.user.upsert({
    where: { email: "dummy@demo.sa" },
    update: { password: dummyPw, role: "ADMIN", organizationId: dummyOrg.id },
    create: { email: "dummy@demo.sa", name: "Dummy Admin", password: dummyPw, role: "ADMIN", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "pm@demo.sa" },
    update: { password: dummyPw, role: "MANAGER", organizationId: dummyOrg.id },
    create: { email: "pm@demo.sa", name: "Sara Al-Qahtani", password: dummyPw, role: "MANAGER", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "sales@demo.sa" },
    update: { password: dummyPw, role: "AGENT", organizationId: dummyOrg.id },
    create: { email: "sales@demo.sa", name: "Khalid Al-Dosari", password: dummyPw, role: "AGENT", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company" },
  });
  await prisma.user.upsert({
    where: { email: "tech@demo.sa" },
    update: { password: dummyPw, role: "TECHNICIAN", organizationId: dummyOrg.id },
    create: { email: "tech@demo.sa", name: "Fahad Al-Mutairi", password: dummyPw, role: "TECHNICIAN", organizationId: dummyOrg.id, onboardingCompleted: true, accountType: "company" },
  });
  console.log("Created 4 Dummy Org users");

  // Off-plan project under Dummy Org
  const offPlanProject = await prisma.project.upsert({
    where: { id: "dummy-offplan-project-1" },
    update: { organizationId: dummyOrg.id, status: "INFRASTRUCTURE_PLANNING" },
    create: {
      id: "dummy-offplan-project-1",
      name: "مشروع واحة النخيل",
      description: "مشروع سكني تجريبي لتطوير أرض بيضاء في شمال الرياض",
      type: "RESIDENTIAL",
      status: "INFRASTRUCTURE_PLANNING",
      organizationId: dummyOrg.id,
      parcelNumber: "P-8800-01",
      plotNumber: "55",
      blockNumber: "B3",
      deedNumber: "DEED-1447-990011",
      landUse: "RESIDENTIAL_LAND",
      totalAreaSqm: 20000,
      region: "منطقة الرياض",
      city: "الرياض",
      district: "العارض",
      latitude: 24.8500,
      longitude: 46.6200,
      estimatedValueSar: 60000000,
      suitabilityScore: 82,
    },
  });
  console.log("Off-plan project:", offPlanProject.name);

  // Subdivision Plan + blocks + plots
  const subPlan = await prisma.subdivisionPlan.create({
    data: {
      projectId: offPlanProject.id,
      name: "Master Plan v1",
      nameArabic: "المخطط الرئيسي v1",
      status: "APPROVED",
      totalAreaSqm: 20000,
      developableAreaSqm: 14000,
      numberOfPhases: 2,
      plotCount: 10,
      blockCount: 2,
      approvedBy: "dummy@demo.sa",
      approvedAt: new Date("2026-01-15"),
      organizationId: dummyOrg.id,
    },
  });

  const block1 = await prisma.block.create({
    data: { subdivisionPlanId: subPlan.id, blockNumber: "B1", areaSqm: 8000, landUse: "RESIDENTIAL_LAND", numberOfPlots: 5, organizationId: dummyOrg.id },
  });
  const block2 = await prisma.block.create({
    data: { subdivisionPlanId: subPlan.id, blockNumber: "B2", areaSqm: 6000, landUse: "MIXED_USE_LAND", numberOfPlots: 5, organizationId: dummyOrg.id },
  });

  const plotData = [
    { plotNumber: "P-01", blockId: block1.id, areaSqm: 600, phase: 1, productType: "VILLA" },
    { plotNumber: "P-02", blockId: block1.id, areaSqm: 550, phase: 1, productType: "VILLA" },
    { plotNumber: "P-03", blockId: block1.id, areaSqm: 500, phase: 1, productType: "VILLA" },
    { plotNumber: "P-04", blockId: block1.id, areaSqm: 450, phase: 1, productType: "TOWNHOUSE" },
    { plotNumber: "P-05", blockId: block1.id, areaSqm: 450, phase: 1, productType: "TOWNHOUSE" },
    { plotNumber: "P-06", blockId: block2.id, areaSqm: 700, phase: 2, productType: "VILLA" },
    { plotNumber: "P-07", blockId: block2.id, areaSqm: 400, phase: 2, productType: "TOWNHOUSE" },
    { plotNumber: "P-08", blockId: block2.id, areaSqm: 350, phase: 2, productType: "DUPLEX" },
    { plotNumber: "P-09", blockId: block2.id, areaSqm: 800, phase: 2, productType: "COMMERCIAL_LOT" },
    { plotNumber: "P-10", blockId: block2.id, areaSqm: 300, phase: 2, productType: "APARTMENT_BLOCK" },
  ];
  for (const p of plotData) {
    await prisma.plot.create({
      data: {
        subdivisionPlanId: subPlan.id,
        plotNumber: p.plotNumber,
        blockId: p.blockId,
        areaSqm: p.areaSqm,
        landUse: "RESIDENTIAL_LAND",
        phase: p.phase,
        productType: p.productType,
        status: "APPROVED",
        organizationId: dummyOrg.id,
      },
    });
  }
  console.log("Created subdivision plan with 2 blocks, 10 plots");

  // Approval submissions
  await prisma.approvalSubmission.create({
    data: {
      projectId: offPlanProject.id,
      authority: "Balady Riyadh",
      authorityArabic: "أمانة منطقة الرياض",
      type: "SUBDIVISION_APPROVAL",
      referenceNumber: "BAL-2026-001122",
      status: "APPROVED_FINAL",
      submittedAt: new Date("2025-12-01"),
      responseDate: new Date("2026-01-10"),
      responseNotes: "Approved with standard conditions",
      organizationId: dummyOrg.id,
    },
  });
  await prisma.approvalSubmission.create({
    data: {
      projectId: offPlanProject.id,
      authority: "Saudi Electricity Company",
      authorityArabic: "الشركة السعودية للكهرباء",
      type: "UTILITY_CONNECTION",
      referenceNumber: "SEC-2026-004455",
      status: "SUBMITTED",
      submittedAt: new Date("2026-02-15"),
      organizationId: dummyOrg.id,
    },
  });
  console.log("Created 2 approval submissions");

  // Infrastructure items (5 categories, varied readiness)
  const infraData = [
    { category: "ELECTRICITY_INFRA" as const, status: "COMPLETED_INFRA" as const, readinessScore: 100, contractor: "شركة الكهرباء المتقدمة", estimatedCostSar: 1200000, wave: 1 },
    { category: "WATER_INFRA" as const, status: "IN_PROGRESS_INFRA" as const, readinessScore: 60, contractor: "مؤسسة المياه الوطنية", estimatedCostSar: 800000, wave: 1 },
    { category: "ROADS_INFRA" as const, status: "COMPLETED_INFRA" as const, readinessScore: 100, contractor: "شركة الطرق السعودية", estimatedCostSar: 3500000, wave: 1 },
    { category: "SEWAGE_INFRA" as const, status: "DESIGN_PHASE" as const, readinessScore: 25, estimatedCostSar: 600000, wave: 2 },
    { category: "LANDSCAPING_INFRA" as const, status: "NOT_STARTED" as const, readinessScore: 0, estimatedCostSar: 400000, wave: 2 },
  ];
  for (const inf of infraData) {
    await prisma.infrastructureReadiness.create({
      data: {
        projectId: offPlanProject.id,
        category: inf.category,
        status: inf.status,
        readinessScore: inf.readinessScore,
        contractor: inf.contractor,
        estimatedCostSar: inf.estimatedCostSar,
        wave: inf.wave,
        targetDate: new Date("2026-06-30"),
        organizationId: dummyOrg.id,
        ...(inf.status === "COMPLETED_INFRA" ? { completedDate: new Date("2026-02-01") } : {}),
      },
    });
  }
  console.log("Created 5 infrastructure items");

  // Inventory items (10 items, mixed types)
  const invItems = [
    { itemNumber: "INV-001", productType: "VILLA_PLOT" as const, areaSqm: 600, basePriceSar: 2100000, releasePhase: 1, status: "AVAILABLE_INV" as const, channel: "DIRECT" as const },
    { itemNumber: "INV-002", productType: "VILLA_PLOT" as const, areaSqm: 550, basePriceSar: 1925000, releasePhase: 1, status: "AVAILABLE_INV" as const, channel: "DIRECT" as const },
    { itemNumber: "INV-003", productType: "VILLA_PLOT" as const, areaSqm: 500, basePriceSar: 1750000, releasePhase: 1, status: "RESERVED_INV" as const, channel: "BROKER" as const },
    { itemNumber: "INV-004", productType: "TOWNHOUSE_PLOT" as const, areaSqm: 450, basePriceSar: 1350000, releasePhase: 1, status: "SOLD_INV" as const, channel: "DIRECT" as const },
    { itemNumber: "INV-005", productType: "TOWNHOUSE_PLOT" as const, areaSqm: 450, basePriceSar: 1350000, releasePhase: 1, status: "AVAILABLE_INV" as const, channel: "ONLINE" as const },
    { itemNumber: "INV-006", productType: "VILLA_PLOT" as const, areaSqm: 700, basePriceSar: 2450000, releasePhase: 2, status: "UNRELEASED" as const, channel: "VIP" as const },
    { itemNumber: "INV-007", productType: "TOWNHOUSE_PLOT" as const, areaSqm: 400, basePriceSar: 1200000, releasePhase: 2, status: "UNRELEASED" as const, channel: "DIRECT" as const },
    { itemNumber: "INV-008", productType: "DUPLEX_PLOT" as const, areaSqm: 350, basePriceSar: 1050000, releasePhase: 2, status: "UNRELEASED" as const, channel: "DIRECT" as const },
    { itemNumber: "INV-009", productType: "COMMERCIAL_LOT" as const, areaSqm: 800, basePriceSar: 4000000, releasePhase: 2, status: "UNRELEASED" as const, channel: "AUCTION" as const },
    { itemNumber: "INV-010", productType: "APARTMENT_PLOT" as const, areaSqm: 300, basePriceSar: 750000, releasePhase: 2, status: "UNRELEASED" as const, channel: "ONLINE" as const },
  ];
  for (const inv of invItems) {
    await prisma.inventoryItem.create({
      data: {
        projectId: offPlanProject.id,
        itemNumber: inv.itemNumber,
        productType: inv.productType,
        areaSqm: inv.areaSqm,
        basePriceSar: inv.basePriceSar,
        finalPriceSar: inv.basePriceSar,
        pricePerSqm: Math.round(inv.basePriceSar / inv.areaSqm),
        releasePhase: inv.releasePhase,
        status: inv.status,
        channel: inv.channel,
        organizationId: dummyOrg.id,
      },
    });
  }
  console.log("Created 10 inventory items");

  // Pricing rules (3 rules)
  await prisma.pricingRule.create({
    data: { projectId: offPlanProject.id, name: "Base Price", nameArabic: "السعر الأساسي", type: "BASE_PRICE_PER_SQM", factor: 3500, priority: 1, isActive: true, organizationId: dummyOrg.id },
  });
  await prisma.pricingRule.create({
    data: { projectId: offPlanProject.id, name: "Corner Premium", nameArabic: "علاوة الزاوية", type: "CORNER_PREMIUM", factor: 1.15, priority: 2, isActive: true, organizationId: dummyOrg.id },
  });
  await prisma.pricingRule.create({
    data: { projectId: offPlanProject.id, name: "Park Facing", nameArabic: "إطلالة حديقة", type: "PARK_FACING_PREMIUM", fixedAmountSar: 50000, priority: 3, isActive: true, organizationId: dummyOrg.id },
  });
  console.log("Created 3 pricing rules");

  // Launch waves (1 LAUNCHED, 1 PLANNED)
  await prisma.launchWave.create({
    data: {
      projectId: offPlanProject.id,
      waveNumber: 1,
      name: "Wave 1 - Phase 1",
      nameArabic: "الموجة الأولى - المرحلة 1",
      status: "LAUNCHED",
      plannedDate: new Date("2026-03-01"),
      launchedAt: new Date("2026-03-01"),
      inventoryCount: 5,
      totalValueSar: 8475000,
      notes: "Initial launch of Phase 1 inventory",
      organizationId: dummyOrg.id,
    },
  });
  await prisma.launchWave.create({
    data: {
      projectId: offPlanProject.id,
      waveNumber: 2,
      name: "Wave 2 - Phase 2",
      nameArabic: "الموجة الثانية - المرحلة 2",
      status: "PLANNED",
      plannedDate: new Date("2026-06-01"),
      inventoryCount: 5,
      totalValueSar: 9450000,
      notes: "Phase 2 premium plots",
      organizationId: dummyOrg.id,
    },
  });
  console.log("Created 2 launch waves");

  // Decision gate for the off-plan project
  await prisma.decisionGate.create({
    data: {
      projectId: offPlanProject.id,
      fromStage: "LAND_ACQUIRED",
      toStage: "CONCEPT_PLANNING",
      decision: "APPROVED",
      decidedBy: "dummy@demo.sa",
      decidedAt: new Date("2025-10-01"),
      notes: "Land acquisition verified, proceed to concept design",
      organizationId: dummyOrg.id,
    },
  });
  console.log("Created decision gate");

  // ═══════════════════════════════════════════════════════════════════════════
  // BILLING — Plans, Entitlements & Subscriptions
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("Creating plans & subscriptions...");

  // Helper: upsert plan and ensure entitlements always exist
  async function upsertPlanWithEntitlements(
    slug: string,
    planData: Record<string, unknown>,
    entitlements: { featureKey: string; type: string; value: string }[],
  ) {
    const plan = await prisma.plan.upsert({
      where: { slug },
      create: { slug, ...planData } as any,
      update: planData as any,
    });
    // Delete + recreate entitlements to ensure they're always correct
    await prisma.planEntitlement.deleteMany({ where: { planId: plan.id } });
    for (const ent of entitlements) {
      await prisma.planEntitlement.create({ data: { planId: plan.id, ...ent } });
    }
    return plan;
  }

  const starterEntitlements = [
    { featureKey: "projects.max", type: "LIMIT", value: "3" },
    { featureKey: "users.max", type: "LIMIT", value: "5" },
    { featureKey: "units.max", type: "LIMIT", value: "50" },
    { featureKey: "cmms.access", type: "BOOLEAN", value: "false" },
    { featureKey: "offplan.access", type: "BOOLEAN", value: "false" },
    { featureKey: "reports.export", type: "BOOLEAN", value: "false" },
    { featureKey: "pii.encryption", type: "BOOLEAN", value: "false" },
    { featureKey: "audit.access", type: "BOOLEAN", value: "false" },
    { featureKey: "api.access", type: "BOOLEAN", value: "false" },
    { featureKey: "custom.branding", type: "BOOLEAN", value: "false" },
    { featureKey: "sla.priority", type: "LIMIT", value: "standard" },
  ];

  const professionalEntitlements = [
    { featureKey: "projects.max", type: "LIMIT", value: "25" },
    { featureKey: "users.max", type: "LIMIT", value: "25" },
    { featureKey: "units.max", type: "LIMIT", value: "500" },
    { featureKey: "cmms.access", type: "BOOLEAN", value: "true" },
    { featureKey: "offplan.access", type: "BOOLEAN", value: "true" },
    { featureKey: "reports.export", type: "BOOLEAN", value: "true" },
    { featureKey: "pii.encryption", type: "BOOLEAN", value: "true" },
    { featureKey: "audit.access", type: "BOOLEAN", value: "true" },
    { featureKey: "api.access", type: "BOOLEAN", value: "false" },
    { featureKey: "custom.branding", type: "BOOLEAN", value: "false" },
    { featureKey: "sla.priority", type: "LIMIT", value: "business" },
  ];

  const enterpriseEntitlements = [
    { featureKey: "projects.max", type: "LIMIT", value: "unlimited" },
    { featureKey: "users.max", type: "LIMIT", value: "unlimited" },
    { featureKey: "units.max", type: "LIMIT", value: "unlimited" },
    { featureKey: "cmms.access", type: "BOOLEAN", value: "true" },
    { featureKey: "offplan.access", type: "BOOLEAN", value: "true" },
    { featureKey: "reports.export", type: "BOOLEAN", value: "true" },
    { featureKey: "pii.encryption", type: "BOOLEAN", value: "true" },
    { featureKey: "audit.access", type: "BOOLEAN", value: "true" },
    { featureKey: "api.access", type: "BOOLEAN", value: "true" },
    { featureKey: "custom.branding", type: "BOOLEAN", value: "true" },
    { featureKey: "sla.priority", type: "LIMIT", value: "premium" },
  ];

  const starterPlan = await upsertPlanWithEntitlements("starter", {
    nameEn: "Starter", nameAr: "المبتدئ",
    descriptionEn: "Perfect for small property managers", descriptionAr: "مثالي لمديري العقارات الصغار",
    priceMonthly: 0, priceAnnual: 0, trialDays: 0, isPublic: true, isDefault: true, sortOrder: 0,
  }, starterEntitlements);

  const professionalPlan = await upsertPlanWithEntitlements("professional", {
    nameEn: "Professional", nameAr: "الاحترافي",
    descriptionEn: "For growing property management companies", descriptionAr: "لشركات إدارة العقارات المتنامية",
    priceMonthly: 499, priceAnnual: 4790, trialDays: 14, isPublic: true, isDefault: false, sortOrder: 1,
  }, professionalEntitlements);

  await upsertPlanWithEntitlements("enterprise", {
    nameEn: "Enterprise", nameAr: "المؤسسات",
    descriptionEn: "Full platform access with premium support", descriptionAr: "وصول كامل للمنصة مع دعم متميز",
    priceMonthly: 1499, priceAnnual: 14390, trialDays: 14, isPublic: true, isDefault: false, sortOrder: 2,
  }, enterpriseEntitlements);

  // Subscription for Mimaric org (Professional, ACTIVE)
  const existingSub = await prisma.subscription.findFirst({
    where: { organizationId: org.id, status: { in: ["ACTIVE", "TRIALING"] } },
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: professionalPlan.id,
        status: "ACTIVE",
        billingCycle: "ANNUAL",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        priceAtRenewal: 4790,
      },
    });
  }

  // Subscription for Dummy org (Starter, ACTIVE)
  const existingDummySub = await prisma.subscription.findFirst({
    where: { organizationId: dummyOrg.id, status: { in: ["ACTIVE", "TRIALING"] } },
  });
  if (!existingDummySub) {
    await prisma.subscription.create({
      data: {
        organizationId: dummyOrg.id,
        planId: starterPlan.id,
        status: "ACTIVE",
        billingCycle: "ANNUAL",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        priceAtRenewal: 0,
      },
    });
  }

  console.log("Created plans (Starter, Professional, Enterprise) & subscriptions");

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
