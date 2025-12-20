/* eslint-disable no-console */
import { prisma } from '@qr/db';

type Args = { venueId?: string };

const parseArgs = (): Args => {
  const res: Args = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--venueId' && args[i + 1]) {
      res.venueId = args[i + 1];
      i += 1;
    }
  }
  return res;
};

const requireSafety = () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to purge in production.');
    process.exit(1);
  }
  if (process.env.CONFIRM_PURGE_ORDERS !== 'true') {
    console.error('Set CONFIRM_PURGE_ORDERS=true to run this script.');
    process.exit(1);
  }
};

async function purgeOrders({ venueId }: Args) {
  const whereOrders = venueId ? { venueId } : {};

  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({ where: whereOrders, select: { id: true } });
    const orderIds = orders.map((o) => o.id);

    const orderItemIds = orderIds.length
      ? (
          await tx.orderItem.findMany({
            where: { orderId: { in: orderIds } },
            select: { id: true },
          })
        ).map((oi) => oi.id)
      : [];

    const paymentCount = await tx.paymentIntent.count({ where: venueId ? { venueId } : {} });
    const orderCount = orderIds.length;
    const orderItemCount = orderItemIds.length;
    const orderItemModCount = orderItemIds.length
      ? await tx.orderItemModifier.count({ where: { orderItemId: { in: orderItemIds } } })
      : 0;

    console.log('Planned deletion summary:');
    console.log(`  Orders: ${orderCount}`);
    console.log(`  Order items: ${orderItemCount}`);
    console.log(`  Order item modifiers: ${orderItemModCount}`);
    console.log(`  Payments: ${paymentCount}`);
    if (venueId) {
      console.log(`  Scope: venueId=${venueId}`);
    } else {
      console.log('  Scope: all venues');
    }

    if (paymentCount > 0) {
      await tx.paymentIntent.deleteMany({ where: venueId ? { venueId } : {} });
    }
    if (orderItemModCount > 0) {
      await tx.orderItemModifier.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
    }
    if (orderItemCount > 0) {
      await tx.orderItem.deleteMany({ where: { id: { in: orderItemIds } } });
    }
    if (orderCount > 0) {
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    console.log('Deletion complete.');
  });
}

async function main() {
  requireSafety();
  const args = parseArgs();

  console.log('Starting purge of order-related data...');
  await purgeOrders(args);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
