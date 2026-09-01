import { PrismaClient, RoleCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Roles
  const rolesData = [
    {
      code: RoleCode.ADMIN,
      name: 'System Administrator',
      description: 'Full system administration, user management, and rule configuration access.',
    },
    {
      code: RoleCode.INSPECTOR,
      name: 'Field Inspector',
      description: 'Conducts packaged commodity inspections and uploads evidence.',
    },
    {
      code: RoleCode.REVIEWER,
      name: 'Compliance Reviewer',
      description: 'Reviews compliance evaluations, resolves violations, and approves audit results.',
    },
  ];

  for (const role of rolesData) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log('✅ Seeded 3 Roles (ADMIN, INSPECTOR, REVIEWER)');

  // 2. Seed Product Categories
  const categoriesData = [
    { code: 'FOOD', name: 'Food & Edible Commodities', description: 'Packaged food, grains, spices, snacks, and edible items.' },
    { code: 'BEVERAGE', name: 'Beverages & Drinks', description: 'Packaged juices, water, soft drinks, and liquid beverages.' },
    { code: 'COSMETIC', name: 'Cosmetics & Personal Care', description: 'Soaps, creams, shampoos, and personal hygiene commodities.' },
    { code: 'HOUSEHOLD', name: 'Household Products', description: 'Detergents, cleaners, disinfected sprays, and home care items.' },
    { code: 'ELECTRICAL', name: 'Electrical & Electronics', description: 'Packaged electrical appliances, accessories, and components.' },
    { code: 'OTHER', name: 'Other Commodities', description: 'General packaged goods under Legal Metrology Rules.' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const createdCat = await prisma.productCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
    categoryMap.set(cat.code, createdCat.id);
  }
  console.log('✅ Seeded 6 Product Categories');

  // 3. Seed Standard Legal Metrology Rules, Rule Versions & Category Associations
  const rulesData = [
    {
      code: 'LM-PC-MRP',
      name: 'Maximum Retail Price Declaration',
      description: 'Mandatory declaration of MRP inclusive of all taxes under Rule 6(1)(e).',
      category: 'PRICE',
      requirement: 'Package must clearly declare Maximum Retail Price (MRP) in INR inclusive of all taxes.',
      validationType: 'EXISTS_AND_NON_ZERO',
      configuration: { field: 'mrp', mustExist: true, currency: 'INR' },
    },
    {
      code: 'LM-PC-NETQTY',
      name: 'Net Quantity Declaration',
      description: 'Mandatory declaration of Net Quantity in standard units under Rule 6(1)(c).',
      category: 'QUANTITY',
      requirement: 'Package must clearly state net quantity in standard units of weight, volume, or count.',
      validationType: 'STANDARD_UNIT_MATCH',
      configuration: { field: 'netQuantity', mustExist: true },
    },
    {
      code: 'LM-PC-MFGDATE',
      name: 'Date of Manufacture / Packing',
      description: 'Mandatory declaration of Month and Year of manufacture or packing under Rule 6(1)(d).',
      category: 'DATE',
      requirement: 'Package must state month and year of manufacture or packing.',
      validationType: 'DATE_FORMAT_MATCH',
      configuration: { field: 'mfgDate', mustExist: true, allowedFormats: ['MM/YYYY', 'MMM YYYY'] },
    },
    {
      code: 'LM-PC-CONSUMERCARE',
      name: 'Consumer Care Information',
      description: 'Mandatory declaration of name, address, and phone/email for consumer complaints under Rule 6(2).',
      category: 'CONTACT',
      requirement: 'Package must provide consumer care details including contact person/name, address, and phone/email.',
      validationType: 'CONTACT_FIELDS_PRESENT',
      configuration: { field: 'consumerCare', mustExist: true },
    },
  ];

  for (const r of rulesData) {
    const rule = await prisma.rule.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, category: r.category },
      create: {
        code: r.code,
        name: r.name,
        description: r.description,
        category: r.category,
      },
    });

    const ruleVersion = await prisma.ruleVersion.upsert({
      where: {
        ruleId_version: {
          ruleId: rule.id,
          version: 1,
        },
      },
      update: {
        requirement: r.requirement,
        validationType: r.validationType,
        configuration: r.configuration,
      },
      create: {
        ruleId: rule.id,
        version: 1,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        requirement: r.requirement,
        validationType: r.validationType,
        configuration: r.configuration,
      },
    });

    // Link RuleVersion to all product categories as baseline applicable rules
    for (const categoryId of Array.from(categoryMap.values())) {
      await prisma.ruleVersionCategory.upsert({
        where: {
          ruleVersionId_categoryId: {
            ruleVersionId: ruleVersion.id,
            categoryId: categoryId,
          },
        },
        update: {},
        create: {
          ruleVersionId: ruleVersion.id,
          categoryId: categoryId,
        },
      });
    }
  }
  console.log('✅ Seeded 4 Standard Rules, Rule Versions & Category Applicability Maps');

  console.log('✨ Database seeding complete successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
