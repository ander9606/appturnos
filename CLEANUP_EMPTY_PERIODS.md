# Cleanup: Empty Periods from August 31 Bug

Due to the race condition bug in period auto-creation, multiple empty periods were created on August 31. This guide helps you clean them up.

## Quick Start

### Option 1: Using MySQL CLI (Easiest)

```bash
# Connect to your MySQL database
mysql -h localhost -u appturnos -p app_turnos < backend/scripts/limpiar-periodos-vacios.sql
```

### Option 2: Using MySQL Workbench or DBeaver

1. Open your MySQL client
2. Copy the contents of `backend/scripts/limpiar-periodos-vacios.sql`
3. Run Step 1 (SELECT) to view empty periods
4. Review the results
5. Uncomment and run Step 2 (DELETE) to remove them
6. Run Step 3 (verification query) to confirm

### Option 3: Using the Node Script (requires .env setup)

```bash
cd backend
cp .env.example .env
# Edit .env with your real DB credentials
npm run limpiar-periodos-vacios          # View empty periods
npm run limpiar-periodos-vacios delete   # Delete them
```

## What This Does

**Before cleanup:**
- Multiple identical periods (e.g., 16-31 Ago) exist with no employee records
- Clients see "$0 Total" and "0 empleados" — confusing UX
- Database has orphaned period records

**After cleanup:**
- Only legitimate periods remain
- The Aug 31 migration (073) prevents this from happening again
- The app handles race conditions gracefully going forward

## Safety

✅ Safe to run anytime
✅ Only deletes periods with ZERO registros_diarios
✅ Preserves all legitimate payroll data
✅ Backward compatible — no schema changes to existing data

## Verification

After cleanup, run this to confirm:

```sql
SELECT COUNT(*) as empty_periods_remaining
FROM periodos_nomina pn
LEFT JOIN registros_diarios rd ON rd.periodo_id = pn.id
GROUP BY pn.id
HAVING COUNT(rd.id) = 0;
```

Should return 0 rows (no empty periods).

---

**Related:** See `/home/user/appturnos/backend/modules/nomina/periodos/` for the fix implementation.
