/* eslint-disable no-console */
import { prisma } from '@qr/db';
import { createPlatformService } from '../lib/platformService';

const email = process.env.PLATFORM_OWNER_EMAIL ?? 'owner@example.com';
const password = process.env.PLATFORM_OWNER_PASSWORD ?? 'Owner123!';

async function main() {
  const platformService = createPlatformService(prisma);
  const user = await platformService.ensureOwnerUser(email, password);
  console.log('Seeded platform owner user:', { email: user.email, role: user.role });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
