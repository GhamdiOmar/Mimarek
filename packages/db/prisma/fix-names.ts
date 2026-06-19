// One-off: replace owner-name fragments in the already-seeded live data with
// generic demo names (so marketing screenshots show no real personal name).
// Safe to re-run (idempotent). Customer name/nameArabic are plaintext (not PII-encrypted).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.updateMany({
    where: { name: "Omar Al-Ghamdi" },
    data: { name: "Mohammed Al-Otaibi" },
  });
  console.log("users 'Omar Al-Ghamdi' -> 'Mohammed Al-Otaibi':", admin.count);

  const k = await prisma.customer.updateMany({
    where: { name: "Khalid Al-Ghamdi" },
    data: { name: "Khalid Al-Otaibi", nameArabic: "خالد عبدالله العتيبي" },
  });
  console.log("customer 'Khalid Al-Ghamdi' -> 'Khalid Al-Otaibi':", k.count);

  const o = await prisma.customer.updateMany({
    where: { name: "Omar Al-Zahrani" },
    data: { name: "Saud Al-Zahrani", nameArabic: "سعود سعيد الزهراني" },
  });
  console.log("customer 'Omar Al-Zahrani' -> 'Saud Al-Zahrani':", o.count);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
