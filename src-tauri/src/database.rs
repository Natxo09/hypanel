use sqlx::{sqlite::SqlitePoolOptions, FromRow, Pool, Sqlite};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub type DbPool = Pool<Sqlite>;

/// Get the database file path
fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_data = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_data).expect("Failed to create app data dir");
    app_data.join("hypanel.db")
}

/// Initialize the database connection pool
pub async fn init_db(app: &AppHandle) -> Result<DbPool, sqlx::Error> {
    let db_path = get_db_path(app);
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    println!("[database] Initializing database at: {}", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Run migrations
    run_migrations(&pool).await?;

    println!("[database] Database initialized successfully");

    Ok(pool)
}

/// Run database migrations
async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    println!("[database] Running migrations...");

    // Create instances table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS instances (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            java_path TEXT,
            jvm_args TEXT,
            server_args TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create settings table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    println!("[database] Migrations completed");

    Ok(())
}

// ============================================================================
// Instance operations
// ============================================================================

use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub path: String,
    pub java_path: Option<String>,
    pub jvm_args: Option<String>,
    pub server_args: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInstanceInput {
    pub name: String,
    pub path: String,
    pub java_path: Option<String>,
}

/// Create a new instance
pub async fn create_instance(pool: &DbPool, input: CreateInstanceInput) -> Result<Instance, sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO instances (id, name, path, java_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.path)
    .bind(&input.java_path)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    Ok(Instance {
        id,
        name: input.name,
        path: input.path,
        java_path: input.java_path,
        jvm_args: None,
        server_args: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Get all instances
pub async fn get_all_instances(pool: &DbPool) -> Result<Vec<Instance>, sqlx::Error> {
    let instances = sqlx::query_as::<_, Instance>(
        r#"
        SELECT id, name, path, java_path, jvm_args, server_args, created_at, updated_at
        FROM instances
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(instances)
}

/// Get instance by ID
pub async fn get_instance_by_id(pool: &DbPool, id: &str) -> Result<Option<Instance>, sqlx::Error> {
    let instance = sqlx::query_as::<_, Instance>(
        r#"
        SELECT id, name, path, java_path, jvm_args, server_args, created_at, updated_at
        FROM instances
        WHERE id = ?
        "#
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(instance)
}

/// Get instance by path
pub async fn get_instance_by_path(pool: &DbPool, path: &str) -> Result<Option<Instance>, sqlx::Error> {
    let instance = sqlx::query_as::<_, Instance>(
        r#"
        SELECT id, name, path, java_path, jvm_args, server_args, created_at, updated_at
        FROM instances
        WHERE path = ?
        "#
    )
    .bind(path)
    .fetch_optional(pool)
    .await?;

    Ok(instance)
}

/// Delete instance by ID
pub async fn delete_instance(pool: &DbPool, id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM instances WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Update instance
pub async fn update_instance(
    pool: &DbPool,
    id: &str,
    name: Option<String>,
    java_path: Option<String>,
    jvm_args: Option<String>,
    server_args: Option<String>,
) -> Result<bool, sqlx::Error> {
    let now = Utc::now().to_rfc3339();

    // Build dynamic update query
    let mut updates = vec!["updated_at = ?"];
    let mut values: Vec<String> = vec![now];

    if let Some(n) = name {
        updates.push("name = ?");
        values.push(n);
    }
    if let Some(jp) = java_path {
        updates.push("java_path = ?");
        values.push(jp);
    }
    if let Some(ja) = jvm_args {
        updates.push("jvm_args = ?");
        values.push(ja);
    }
    if let Some(sa) = server_args {
        updates.push("server_args = ?");
        values.push(sa);
    }

    let query = format!(
        "UPDATE instances SET {} WHERE id = ?",
        updates.join(", ")
    );

    let mut q = sqlx::query(&query);
    for v in values {
        q = q.bind(v);
    }
    q = q.bind(id);

    let result = q.execute(pool).await?;

    Ok(result.rows_affected() > 0)
}

// ============================================================================
// Settings operations
// ============================================================================

/// Get a setting value
pub async fn get_setting(pool: &DbPool, key: &str) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(|r| r.0))
}

/// Set a setting value
pub async fn set_setting(pool: &DbPool, key: &str, value: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        "#,
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;

    Ok(())
}

/// Check if onboarding is completed
pub async fn is_onboarding_completed(pool: &DbPool) -> Result<bool, sqlx::Error> {
    let value = get_setting(pool, "onboarding_completed").await?;
    Ok(value.map(|v| v == "true").unwrap_or(false))
}

/// Mark onboarding as completed
pub async fn set_onboarding_completed(pool: &DbPool) -> Result<(), sqlx::Error> {
    set_setting(pool, "onboarding_completed", "true").await
}
