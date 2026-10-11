import { migrateToErpCollections } from '../services/migration-service';

async function main() {
  console.log('Starting migration to dedicated erp_ collections...');
  const report = await migrateToErpCollections();
  console.log('Migration report:', JSON.stringify(report, null, 2));
  if (report.success) {
    console.log('Migration completed successfully!');
    process.exit(0);
  } else {
    console.error('Migration encountered errors:', report.errors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
