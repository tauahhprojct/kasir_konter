-- Single-statement version for SQL runners that reject multiple queries.
do $$
begin
  execute $q$
    create table if not exists public.shops (
      id uuid primary key references auth.users(id) on delete cascade,
      shop_name text not null default 'Konter Berkah Cell',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $q$;

  execute $q$
    create table if not exists public.wallets (
      id text not null,
      shop_id uuid not null references auth.users(id) on delete cascade,
      name text not null,
      kind text not null default 'cash',
      balance numeric not null default 0,
      low_threshold numeric not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (shop_id, id)
    )
  $q$;

  execute $q$
    create table if not exists public.transactions (
      id text not null,
      shop_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      type text not null,
      category text not null default 'Lainnya',
      product_name text not null default 'Transaksi',
      target_number text,
      customer_name text,
      customer_phone text,
      cost_price numeric not null default 0,
      sell_price numeric not null default 0,
      admin_fee numeric not null default 0,
      profit numeric not null default 0,
      status text not null,
      source_wallet_id text not null,
      destination_wallet_id text,
      paid_at timestamptz,
      notes text,
      updated_at timestamptz not null default now(),
      primary key (shop_id, id)
    )
  $q$;

  execute $q$
    create table if not exists public.products (
      id text not null,
      shop_id uuid not null references auth.users(id) on delete cascade,
      name text not null,
      category text not null default 'Lainnya',
      cost_price numeric not null default 1,
      sell_price numeric not null default 1,
      default_server_id text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (shop_id, id)
    )
  $q$;

  execute $q$
    create table if not exists public.audits (
      id text not null,
      shop_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      wallet_id text not null,
      wallet_name text not null,
      system_balance numeric not null default 0,
      actual_balance numeric not null default 0,
      difference numeric not null default 0,
      notes text,
      primary key (shop_id, id)
    )
  $q$;

  execute 'create index if not exists transactions_shop_created_idx on public.transactions (shop_id, created_at desc)';
  execute 'create index if not exists audits_shop_created_idx on public.audits (shop_id, created_at desc)';

  execute 'alter table public.shops enable row level security';
  execute 'alter table public.wallets enable row level security';
  execute 'alter table public.transactions enable row level security';
  execute 'alter table public.products enable row level security';
  execute 'alter table public.audits enable row level security';

  execute 'drop policy if exists "owner reads own shop" on public.shops';
  execute 'create policy "owner reads own shop" on public.shops for select to authenticated using (id = auth.uid())';
  execute 'drop policy if exists "owner creates own shop" on public.shops';
  execute 'create policy "owner creates own shop" on public.shops for insert to authenticated with check (id = auth.uid())';
  execute 'drop policy if exists "owner updates own shop" on public.shops';
  execute 'create policy "owner updates own shop" on public.shops for update to authenticated using (id = auth.uid()) with check (id = auth.uid())';

  execute 'drop policy if exists "owner manages own wallets" on public.wallets';
  execute 'create policy "owner manages own wallets" on public.wallets for all to authenticated using (shop_id = auth.uid()) with check (shop_id = auth.uid())';
  execute 'drop policy if exists "owner manages own transactions" on public.transactions';
  execute 'create policy "owner manages own transactions" on public.transactions for all to authenticated using (shop_id = auth.uid()) with check (shop_id = auth.uid())';
  execute 'drop policy if exists "owner manages own products" on public.products';
  execute 'create policy "owner manages own products" on public.products for all to authenticated using (shop_id = auth.uid()) with check (shop_id = auth.uid())';
  execute 'drop policy if exists "owner manages own audits" on public.audits';
  execute 'create policy "owner manages own audits" on public.audits for all to authenticated using (shop_id = auth.uid()) with check (shop_id = auth.uid())';
end
$$;
