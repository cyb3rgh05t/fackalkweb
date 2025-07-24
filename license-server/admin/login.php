<?php
// ===== DATEI: admin/login.php =====
require_once '../config/database.php';
require_once 'auth.php';

// Bereits eingeloggt? Dann weiterleiten
if (isLoggedIn()) {
    $redirect = $_GET['redirect'] ?? 'index.php';
    header('Location: ' . $redirect);
    exit;
}

$error_message = '';
$success_message = '';

// Login-Verarbeitung
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        $error_message = 'Benutzername und Passwort sind erforderlich';
    } else {
        if (login($username, $password)) {
            $redirect = $_GET['redirect'] ?? 'index.php';
            header('Location: ' . $redirect);
            exit;
        } else {
            $error_message = 'Ungültige Anmeldedaten';

            // Log failed login attempt
            logActivity('admin_login_failed', [
                'username' => $username,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]);
        }
    }
}

if (isset($_GET['logged_out'])) {
    $success_message = 'Sie wurden erfolgreich abgemeldet';
}
?>

<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔐 Admin-Login - KFZ Lizenz-Verwaltung</title>
    <link rel="stylesheet" href="../assets/style.css">
    <link rel="stylesheet" href="../assets/login.css">
</head>

<body>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h1>🔐 Admin-Login</h1>
                <p>Lizenz-Verwaltung</p>
            </div>

            <?php if ($error_message): ?>
                <div class="alert alert-error">
                    ❌ <?php echo htmlspecialchars($error_message); ?>
                </div>
            <?php endif; ?>

            <?php if ($success_message): ?>
                <div class="alert alert-success">
                    ✅ <?php echo htmlspecialchars($success_message); ?>
                </div>
            <?php endif; ?>

            <form method="POST" class="login-form">
                <div class="form-group">
                    <label for="username">Benutzername:</label>
                    <input type="text" id="username" name="username" required
                        value="<?php echo htmlspecialchars($_POST['username'] ?? ''); ?>"
                        autocomplete="username">
                </div>

                <div class="form-group">
                    <label for="password">Passwort:</label>
                    <input type="password" id="password" name="password" required
                        autocomplete="current-password">
                </div>

                <button type="submit" class="login-button">
                    🚀 Anmelden
                </button>
            </form>

            <div class="login-footer">
                <p>Sichere Verbindung • Session-Timeout: 8h</p>
            </div>
        </div>
    </div>

    <script>
        // Auto-Focus auf Username-Feld
        document.getElementById('username').focus();

        // Enter-Taste im Username-Feld springt zu Passwort
        document.getElementById('username').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('password').focus();
            }
        });

        // Einfache Form-Validierung
        document.querySelector('.login-form').addEventListener('submit', function(e) {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
                e.preventDefault();
                alert('Bitte alle Felder ausfüllen');
                return;
            }

            // Loading-State für Button
            const button = document.querySelector('.login-button');
            button.innerHTML = '⏳ Anmeldung läuft...';
            button.disabled = true;
        });
    </script>
</body>

</html>