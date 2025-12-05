-- Migración: Agregar campos de onboarding a la tabla users
-- Campos: study_type, career_interest, nationality

-- Agregar columna study_type (tipo de estudio: máster, posgrado, grado, etc.)
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'users' 
        and column_name = 'study_type'
    ) then
        alter table public.users 
        add column study_type text;
    end if;
end $$;

-- Agregar columna career_interest (carrera que busca)
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'users' 
        and column_name = 'career_interest'
    ) then
        alter table public.users 
        add column career_interest text;
    end if;
end $$;

-- Agregar columna nationality (nacionalidad)
do $$
begin
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'users' 
        and column_name = 'nationality'
    ) then
        alter table public.users 
        add column nationality text;
    end if;
end $$;



