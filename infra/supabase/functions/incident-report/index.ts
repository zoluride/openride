// deno-lint-ignore-file no-explicit-any
import { handleCors, error, json } from '../_shared/cors.ts';
import { HttpError, audit, operatorOf, requireCaller } from '../_shared/auth.ts';

interface Body {
  category: string;
  severity: string;
  description: string;
  trip_id?: string;
  vehicle_id?: string;
  location_lat?: number;
  location_lng?: number;
  attachments?: Array<{ path: string; mime_type: string }>;
}

Deno.serve(async (req: Request) => {
  const pre = handleCors(req);
  if (pre) return pre;
  if (req.method !== 'POST') return error('Method not allowed', 405);

  try {
    const ctx = await requireCaller(req, ['driver', 'rider']);
    const body = (await req.json()) as Body;

    // Validate required fields
    if (!body?.category) return error('category is required');
    if (!body?.severity) return error('severity is required');
    if (!body?.description) return error('description is required');
    if (!body.description.trim()) return error('description cannot be empty');

    const operatorId = await operatorOf(ctx.serviceClient, ctx.userId);

    // If trip_id is provided, verify driver/rider is associated with it
    let tripData: any = null;
    if (body.trip_id) {
      const { data: trip, error: tripErr } = await ctx.client
        .from('trips')
        .select('driver_id, rider_id, vehicle_id')
        .eq('id', body.trip_id)
        .maybeSingle();
      if (tripErr) return error(tripErr.message, 500, 'db_error');
      if (!trip) return error('Trip not found or not accessible', 404);
      tripData = trip as any;
      // Verify caller is driver or rider on this trip
      if (tripData.driver_id !== ctx.userId && tripData.rider_id !== ctx.userId) {
        return error('Not authorized to report on this trip', 403);
      }
    }

    // If vehicle_id is provided, verify driver owns it
    if (body.vehicle_id) {
      const { data: vehicle, error: vErr } = await ctx.client
        .from('vehicles')
        .select('id, default_driver_id')
        .eq('id', body.vehicle_id)
        .maybeSingle();
      if (vErr) return error(vErr.message, 500, 'db_error');
      if (!vehicle) return error('Vehicle not found or not accessible', 404);
      const v = vehicle as any;
      // Only driver can specify their own vehicle
      if (v.default_driver_id !== ctx.userId && body.trip_id === undefined) {
        return error('Not authorized to report on this vehicle', 403);
      }
    }

    // Build location point if provided
    let locationPoint = null;
    if (body.location_lat !== undefined && body.location_lng !== undefined) {
      locationPoint = `SRID=4326;POINT(${body.location_lng} ${body.location_lat})`;
    }

    // Determine driver_id and rider_id from context
    let driverId = null;
    let riderId = null;
    const { data: userData } = await ctx.serviceClient
      .from('users')
      .select('role')
      .eq('id', ctx.userId)
      .maybeSingle();
    const userRole = (userData as any)?.role;
    if (userRole === 'driver') {
      driverId = ctx.userId;
    } else if (userRole === 'rider') {
      riderId = ctx.userId;
    }

    // Insert the incident report
    const { data: incident, error: incErr } = await ctx.serviceClient
      .from('incident_reports')
      .insert({
        reported_by: ctx.userId,
        driver_id: driverId || (tripData?.driver_id ?? body.vehicle_id ? undefined : null),
        rider_id: riderId || (tripData?.rider_id ?? null),
        trip_id: body.trip_id ?? null,
        vehicle_id: body.vehicle_id ?? (tripData?.vehicle_id ?? null),
        category: body.category,
        severity: body.severity,
        description: body.description.trim(),
        location_point: locationPoint,
        attachments: body.attachments ?? [],
        operator_id: operatorId,
      })
      .select('*')
      .single();

    if (incErr) return error(incErr.message, 500, 'db_error');

    // Audit the incident report creation
    await audit(ctx, 'incident.create', 'incident_reports', (incident as any).id, null, incident);

    return json({ id: (incident as any).id, ok: true });
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status, e.code);
    return error((e as Error).message, 500, 'unexpected');
  }
});
