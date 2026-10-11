import { bootstrapInitialSuperAdmin } from '../services/seed-service';

async function main() {
  console.log('Initiating Super Admin provisioning...');
  const result = await bootstrapInitialSuperAdmin();
  if (result.success) {
    console.log('Success:', result.message);
    console.log('User UID:', result.user?.uid);
    console.log('Role:', result.user?.role);
    console.log('Email:', result.user?.email);
    process.exit(0);
  } else {
    console.error('Error:', result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
