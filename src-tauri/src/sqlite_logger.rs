use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

const EXPIRE_DAYS: i64 = 7;

pub struct SqliteLogger {
    conn: Mutex<Connection>,
}

impl SqliteLogger {
    pub fn new(db_path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL DEFAULT (datetime('now')),
                level TEXT NOT NULL,
                target TEXT NOT NULL,
                message TEXT NOT NULL,
                app_version TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);",
        )?;

        // 1週間以上古いログを削除
        conn.execute(
            &format!(
                "DELETE FROM logs WHERE timestamp < datetime('now', '-{} days')",
                EXPIRE_DAYS
            ),
            [],
        )?;

        log::info!("SQLite logger initialized: {}", db_path.display());

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn insert(&self, level: &str, target: &str, message: &str, app_version: &str) {
        if let Ok(conn) = self.conn.lock() {
            let _ = conn.execute(
                "INSERT INTO logs (level, target, message, app_version) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![level, target, message, app_version],
            );
        }
    }

    pub fn to_fern_dispatch(self, app_version: String) -> fern::Dispatch {
        let logger = std::sync::Arc::new(self);
        fern::Dispatch::new().chain(fern::Output::call(move |record| {
            logger.insert(
                &record.level().to_string(),
                record.target(),
                &record.args().to_string(),
                &app_version,
            );
        }))
    }
}
