import path from 'node:path';
import dotenv from 'dotenv';

// Always load root .env, regardless of where the command is run from
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { prisma } from '@qr/db';
import { UserRoleEnum } from '@qr/types';
import { hashPassword } from '../lib/crypto';

async function main() {
  await prisma.venue.upsert({
    where: { id: 'venue-demo' },
    update: {},
    create: { id: 'venue-demo', name: 'Demo Venue', slug: 'demo' },
  });

  const passwordHash = await hashPassword(process.env.STAFF_DEMO_PASSWORD || 'ChangeMe123!');

  const roles = [
    UserRoleEnum.enum.ADMIN,
    UserRoleEnum.enum.WAITER,
    UserRoleEnum.enum.KITCHEN,
  ];

  for (const role of roles) {
    const email = `${role.toLowerCase()}@example.com`;
    await prisma.staffUser.upsert({
      where: { email },
      update: {
        venueId: 'venue-demo',
        role,
        name: `${role.toLowerCase()} demo`,
        passwordHash,
        isActive: true,
      },
      create: {
        id: `staff-${role.toLowerCase()}`,
        venueId: 'venue-demo',
        role,
        name: `${role.toLowerCase()} demo`,
        email,
        passwordHash,
        isActive: true,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
