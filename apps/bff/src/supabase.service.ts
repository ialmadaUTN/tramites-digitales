import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tramites/form-contracts';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client!: SupabaseClient<Database>;

  onModuleInit() {
    const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
    const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Database types are generated from the portable public schema. A hosted
    // project may expose the same tables through a custom REST schema.
    const schema = (process.env.SUPABASE_DB_SCHEMA ?? 'public') as 'public';
    if (!key) throw new Error('Falta SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY');
    this.client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema },
    });
  }

  get db(): SupabaseClient<Database> {
    if (!this.client) throw new Error('Supabase todavía no fue inicializado');
    return this.client;
  }
}
