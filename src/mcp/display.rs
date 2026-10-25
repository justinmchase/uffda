//! Session display surface tools (loopback HTML preview).
//!
//! Opens a loopback-only HTTP endpoint and launches the system browser so the
//! surface is human-observable without Deno's desktop shell.

use serde_json::{Value, json};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Default)]
pub struct DisplayManager {
    surfaces: HashMap<String, DisplaySurface>,
}

struct DisplaySurface {
    html: Arc<Mutex<String>>,
    addr: String,
}

impl DisplayManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open(&mut self, session_id: &str) -> Value {
        if self.surfaces.contains_key(session_id) {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_DISPLAY_ALREADY_OPEN",
                    "phase": "input",
                    "message": format!("Display surface already open for session '{session_id}'")
                }
            });
        }
        let listener = match TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => listener,
            Err(error) => {
                return json!({
                    "ok": false,
                    "error": {
                        "code": "MCP_DISPLAY_INVALID_INPUT",
                        "phase": "input",
                        "message": format!("Unable to bind loopback display endpoint: {error}")
                    }
                });
            }
        };
        let addr = match listener.local_addr() {
            Ok(addr) => format!("http://{addr}/"),
            Err(error) => {
                return json!({
                    "ok": false,
                    "error": {
                        "code": "MCP_DISPLAY_INVALID_INPUT",
                        "phase": "input",
                        "message": error.to_string()
                    }
                });
            }
        };
        let html = Arc::new(Mutex::new(String::from(
            "<!doctype html><title>uffda</title><body><p>uffda display surface</p></body>",
        )));
        let served = Arc::clone(&html);
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let body = served.lock().map(|guard| guard.clone()).unwrap_or_default();
                let _ = serve_html(stream, &body);
            }
        });
        let _ = open_browser(&addr);
        self.surfaces.insert(
            session_id.to_string(),
            DisplaySurface {
                html,
                addr: addr.clone(),
            },
        );
        json!({ "ok": true, "url": addr })
    }

    pub fn render(&mut self, session_id: &str, markup: &str) -> Value {
        let Some(surface) = self.surfaces.get_mut(session_id) else {
            return json!({
                "ok": false,
                "error": {
                    "code": "MCP_DISPLAY_NO_OPEN_SURFACE",
                    "phase": "input",
                    "message": "call uffda_session_display_open first"
                }
            });
        };
        if let Ok(mut html) = surface.html.lock() {
            *html = markup.to_string();
        }
        json!({ "ok": true, "url": surface.addr })
    }

    pub fn close(&mut self, session_id: &str) {
        self.surfaces.remove(session_id);
    }
}

fn serve_html(mut stream: std::net::TcpStream, body: &str) -> std::io::Result<()> {
    let mut buffer = [0u8; 1024];
    let _ = stream.read(&mut buffer);
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

fn open_browser(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(url).spawn()?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", url])
            .spawn()?;
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
    Ok(())
}

pub fn display_tool_descriptors() -> Vec<Value> {
    vec![
        json!({
            "name": "uffda_session_display_open",
            "title": "uffda session display open",
            "description": "Opens a loopback-only human-observable display surface for a session.",
            "inputSchema": {
                "type": "object",
                "properties": { "sessionId": { "type": "string" } },
                "required": ["sessionId"],
                "additionalProperties": false
            }
        }),
        json!({
            "name": "uffda_session_display_render",
            "title": "uffda session display render",
            "description": "Renders a retained match result or highlighted source into the session display surface.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "sessionId": { "type": "string" },
                    "matchResultId": { "type": "string" },
                    "source": { "type": "string" },
                    "language": {
                        "type": "string",
                        "enum": ["uffda", "pattern", "expression"]
                    }
                },
                "required": ["sessionId"],
                "additionalProperties": false
            }
        }),
    ]
}
