-- Rode no Supabase: SQL Editor > New query > Run
create extension if not exists pgcrypto;

create table categories(id serial primary key, name text unique not null, position int default 0);
create table products(
  id uuid primary key default gen_random_uuid(),
  category_id int references categories(id),
  name text not null, description text,
  price_cents int not null check (price_cents > 0),
  image_url text, visible boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table gifts(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  guest_name text not null check (char_length(guest_name) between 2 and 80),
  amount_cents int not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  guest_claimed_paid boolean not null default false,
  message text check (char_length(message) <= 1000),
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz default now(), updated_at timestamptz default now());
-- Garante no banco: só UMA reserva ativa por produto (impede dois convidados no mesmo item)
create unique index one_active_gift_per_product on gifts(product_id) where status in ('pending','confirmed');
create table event_settings(
  id int primary key default 1 check (id = 1),
  invite_text text default '', event_date text default '', event_time text default '',
  address text default '', notes text default '');
insert into event_settings default values;
create table admins(user_id uuid primary key references auth.users on delete cascade);

create or replace function is_admin() returns boolean language sql security definer set search_path=public stable
as $$ select exists(select 1 from admins where user_id = auth.uid()) $$;

alter table categories enable row level security; alter table products enable row level security;
alter table gifts enable row level security; alter table event_settings enable row level security;
alter table admins enable row level security;  -- sem policies = ninguém acessa via API

create policy cat_read on categories for select using (true);
create policy cat_admin on categories for all using (is_admin()) with check (is_admin());
create policy prod_read on products for select using (visible or is_admin());
create policy prod_admin on products for all using (is_admin()) with check (is_admin());
create policy ev_read on event_settings for select using (true);
create policy ev_admin on event_settings for update using (is_admin()) with check (is_admin());
-- gifts: SOMENTE admin lê/escreve. Convidados só usam as funções abaixo.
create policy gifts_admin on gifts for all using (is_admin()) with check (is_admin());

-- Lista pública: mostra só "disponível ou não", nunca quem escolheu.
create or replace function list_products() returns table(id uuid, category text, name text, description text, price_cents int, image_url text, available boolean)
language sql security definer set search_path=public stable as $$
  select p.id, c.name, p.name, p.description, p.price_cents, p.image_url,
    not exists(select 1 from gifts g where g.product_id=p.id and (g.status='confirmed' or (g.status='pending' and (g.guest_claimed_paid or g.expires_at>now()))))
  from products p left join categories c on c.id=p.category_id where p.visible order by c.position, p.price_cents $$;

create or replace function reserve_gift(p_product uuid, p_name text) returns table(gift_id uuid, token uuid, amount_cents int, product_name text)
language plpgsql security definer set search_path=public as $$
declare pr products; g gifts;
begin
  select * into pr from products where id=p_product and visible;
  if not found then raise exception 'produto_inexistente'; end if;
  update gifts set status='cancelled', updated_at=now()
    where product_id=p_product and status='pending' and not guest_claimed_paid and expires_at<now();
  begin
    insert into gifts(product_id, guest_name, amount_cents) values (p_product, trim(p_name), pr.price_cents) returning * into g;
  exception when unique_violation then raise exception 'indisponivel'; end;
  return query select g.id, g.token, g.amount_cents, pr.name;
end $$;

create or replace function claim_paid(p_gift uuid, p_token uuid) returns void language sql security definer set search_path=public as $$
  update gifts set guest_claimed_paid=true, expires_at=now()+interval '30 days', updated_at=now()
  where id=p_gift and token=p_token and status='pending' $$;
create or replace function leave_message(p_gift uuid, p_token uuid, p_msg text) returns void language sql security definer set search_path=public as $$
  update gifts set message=left(p_msg,1000), updated_at=now() where id=p_gift and token=p_token and status<>'cancelled' $$;
create or replace function release_gift(p_gift uuid, p_token uuid) returns void language sql security definer set search_path=public as $$
  update gifts set status='cancelled', updated_at=now() where id=p_gift and token=p_token and status='pending' and not guest_claimed_paid $$;

grant execute on function list_products, reserve_gift, claim_paid, leave_message, release_gift to anon, authenticated;

-- Depois de criar seu usuário em Authentication > Users, rode (troque o e-mail):
-- insert into admins select id from auth.users where email='SEU_EMAIL';

insert into categories(name, position) values ('Cozinha e utensílios',1),('Panelas e acessórios',2),('Pratos, copos e talheres',3),('Eletroportáteis',4),('Organização da casa',5),('Limpeza e lavanderia',6),('Quarto e roupa de cama',7),('Banheiro',8),('Sala e decoração',9),('Móveis e itens maiores',10),('Área gourmet e churrasco',11),('Pequenos detalhes',12);

-- Preços são ESTIMATIVAS de mercado (centavos). Edite pelo painel admin.
insert into products(category_id,name,description,price_cents)
select c.id,v.n,v.d,v.p from (values
('Cozinha e utensílios','Jogo de facas 6 peças','Facas de aço inox com suporte',8990),
('Cozinha e utensílios','Conjunto de utensílios de silicone','Colher, espátula, concha e pegador',6990),
('Cozinha e utensílios','Tábuas de corte (kit 3)','Tamanhos P, M e G',5490),
('Cozinha e utensílios','Potes herméticos (kit 10)','Para mantimentos e sobras',12990),
('Cozinha e utensílios','Ralador e descascador','Kit prático de bancada',3990),
('Panelas e acessórios','Jogo de panelas antiaderentes 5 peças','Cabos resistentes ao calor',29990),
('Panelas e acessórios','Frigideira antiaderente 26 cm','Revestimento cerâmico',8990),
('Panelas e acessórios','Panela de pressão 5 L','Segurança e rapidez no dia a dia',17990),
('Panelas e acessórios','Assadeiras (kit 3)','Retangulares em alumínio',7490),
('Panelas e acessórios','Escorredor de macarrão inox','Com cabo longo',3490),
('Pratos, copos e talheres','Jogo de pratos 12 peças','Porcelana branca',24990),
('Pratos, copos e talheres','Jogo de copos de vidro 12 un.','Copos para água e suco',7990),
('Pratos, copos e talheres','Faqueiro inox 24 peças','Garfo, faca e colheres',12990),
('Pratos, copos e talheres','Taças de vinho (6 un.)','Cristal ecológico',9990),
('Pratos, copos e talheres','Jogo de xícaras 6 un.','Com pires',6490),
('Eletroportáteis','Air fryer 4 L','Fritura sem óleo',34990),
('Eletroportáteis','Liquidificador 900 W','Jarra de vidro',18990),
('Eletroportáteis','Cafeteira elétrica','Capacidade para 30 xícaras',15990),
('Eletroportáteis','Sanduicheira','Placas antiaderentes',9990),
('Eletroportáteis','Chaleira elétrica 1,8 L','Desliga automaticamente',18990),
('Eletroportáteis','Batedeira planetária','Com 3 batedores',29990),
('Eletroportáteis','Micro-ondas 30 L','Prático e espaçoso',54990),
('Organização da casa','Organizadores de gaveta (kit)','Divisórias ajustáveis',5990),
('Organização da casa','Cestos organizadores (kit 4)','Para armário e lavanderia',8990),
('Organização da casa','Sapateira 10 pares','Estrutura leve e resistente',12990),
('Organização da casa','Cabides de veludo (30 un.)','Não deixam marcas nas roupas',6990),
('Limpeza e lavanderia','Cesto de roupa suja','Com tampa e alças',8990),
('Limpeza e lavanderia','Tábua e ferro de passar','Conjunto completo',19990),
('Limpeza e lavanderia','Kit vassoura, rodo e pá','Cerdas macias',7490),
('Limpeza e lavanderia','Varal de chão dobrável','Resistente e compacto',11990),
('Limpeza e lavanderia','Aspirador de pó portátil','Uso em sofá e carro',24990),
('Quarto e roupa de cama','Jogo de cama casal 4 peças','Algodão 200 fios',24990),
('Quarto e roupa de cama','Edredom casal','Toque macio',29990),
('Quarto e roupa de cama','Travesseiros (par)','Fibra siliconada',9990),
('Quarto e roupa de cama','Cobertor casal','Microfibra',12990),
('Quarto e roupa de cama','Protetor de colchão','Impermeável',8990),
('Banheiro','Jogo de toalhas 5 peças','Algodão macio',17990),
('Banheiro','Kit banheiro 5 peças','Lixeira, porta-sabonete e mais',6990),
('Banheiro','Tapete antiderrapante','Secagem rápida',3990),
('Banheiro','Cortina de box','Com ganchos',4490),
('Sala e decoração','Tapete de sala 2x1,5 m','Tom areia',34990),
('Sala e decoração','Almofadas decorativas (kit 4)','Com enchimento',9990),
('Sala e decoração','Manta para sofá','Tricô',8990),
('Sala e decoração','Vasos decorativos (kit 3)','Cerâmica',7990),
('Sala e decoração','Luminária de mesa','Luz quente',8990),
('Móveis e itens maiores','Mesa de jantar 4 lugares','Madeira clara',89990),
('Móveis e itens maiores','Estante para sala','Com nichos',59990),
('Móveis e itens maiores','Cadeiras de jantar (par)','Estofadas',44990),
('Móveis e itens maiores','Rack para TV','Até 55 polegadas',49990),
('Área gourmet e churrasco','Churrasqueira portátil','Aço com grelha',29990),
('Área gourmet e churrasco','Kit churrasco 12 peças','Maleta com utensílios',17990),
('Área gourmet e churrasco','Jogo de espetos inox (6)','Para carne e legumes',8990),
('Área gourmet e churrasco','Tábua de carne grande','Madeira com canaleta',7990),
('Pequenos detalhes','Porta-temperos','Giratório',5990),
('Pequenos detalhes','Relógio de parede','Silencioso',6990),
('Pequenos detalhes','Capacho de entrada','Boas-vindas ao lar',4990),
('Pequenos detalhes','Porta-retratos (kit 3)','Para memórias do casal',5490)
) v(c,n,d,p) join categories c on c.name=v.c;

-- usado pelo painel para checar permissão
grant execute on function is_admin to anon, authenticated;
