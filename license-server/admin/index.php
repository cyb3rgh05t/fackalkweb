<?php
require_once 'auth.php';
requireLogin(); // Diese Zeile schützt die Seite
?>

<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔐 Lizenz-Verwaltung</title>
    <link rel="stylesheet" href="../assets/style.css?v2">
    <link rel="stylesheet" href="../assets/index.css?v3">
</head>

<body>
    <div class="container">
        <!-- NEUER TOP-HEADER MIT LOGOUT -->
        <div class="top-header">
            <div class="header-content">
                <div class="logo-section">
                    <a href="index.php" class="logo">
                        🔐 Lizenz-Verwaltung
                    </a>
                    <div class="nav-links">
                        <a href="index.php" class="nav-link">📊 Dashboard</a>
                        <a href="../debug.php" class="nav-link">🔧 Debug</a>
                        <a href="../api/validate.php" class="nav-link">📡 API</a>
                    </div>
                </div>

                <div class="user-section">
                    <div class="user-info">
                        <div class="user-name">
                            <div class="status-indicator"></div>
                            <?php echo htmlspecialchars(getAdminUsername()); ?>
                            <span class="user-badge">ADMIN</span>
                        </div>
                        <div class="session-info">
                            Session: <?php echo getSessionDuration(); ?>
                        </div>
                    </div>
                    
                    <a href="logout.php" class="logout-button" onclick="return confirmLogout()">
                        🚪 Abmelden
                    </a>
                </div>
            </div>
        </div>

      
        <?php
        require_once '../config/database.php';

        // Statistiken laden
        $stats = [];

        // Aktive Lizenzen
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM licenses WHERE status = 'active'");
        $stats['active_licenses'] = $stmt->fetch()['count'];

        // Gesamte Aktivierungen
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM license_activations WHERE status = 'active'");
        $stats['total_activations'] = $stmt->fetch()['count'];

        // Heute neue Aktivierungen
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM license_activations WHERE DATE(first_activation) = CURDATE()");
        $stats['today_activations'] = $stmt->fetch()['count'];

        // Abgelaufene Lizenzen
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM licenses WHERE expires_at < NOW() AND status = 'active'");
        $stats['expired_licenses'] = $stmt->fetch()['count'];
        ?>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['active_licenses']; ?></div>
                <div class="stat-label">Aktive Lizenzen</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['total_activations']; ?></div>
                <div class="stat-label">Gesamte Aktivierungen</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['today_activations']; ?></div>
                <div class="stat-label">Heute neue Aktivierungen</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $stats['expired_licenses']; ?></div>
                <div class="stat-label">Abgelaufene Lizenzen</div>
            </div>
        </div>

        <!-- Rest deines bestehenden Contents bleibt gleich... -->
        
        <!-- Neue Lizenz erstellen -->
        <div class="admin-section">
            <div class="section-header">
                <h2>🆕 Neue Lizenz erstellen</h2>
                <button class="toggle-button" onclick="toggleSection('create-license')">
                    Lizenz erstellen
                </button>
            </div>
            <div class="section-content">
                <div class="collapsible-content" id="create-license">
                    <div class="admin-form">
                        <form method="POST" action="create_license.php">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Kundenname:</label>
                                    <input type="text" name="customer_name" required placeholder="Max Mustermann">
                                </div>
                                <div class="form-group">
                                    <label>E-Mail:</label>
                                    <input type="email" name="customer_email" required placeholder="max@example.com">
                                </div>
                                <div class="form-group">
                                    <label>Firma (optional):</label>
                                    <input type="text" name="company" placeholder="Musterfirma GmbH">
                                </div>
                                <div class="form-group">
                                    <label>Lizenz-Typ:</label>
                                    <select name="license_type" required>
                                        <option value="basic">Basic (1 PC)</option>
                                        <option value="professional">Professional (2 PCs)</option>
                                        <option value="enterprise">Enterprise (5 PCs)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Max. Aktivierungen:</label>
                                    <input type="number" name="max_activations" value="1" min="1" max="10" required>
                                </div>
                                <div class="form-group">
                                    <label>Ablaufdatum (optional):</label>
                                    <input type="date" name="expires_at" min="<?php echo date('Y-m-d'); ?>">
                                </div>
                            </div>

                            <div class="features-section">
                                <div class="form-group">
                                    <label>Features:</label>
                                    <div class="checkbox-group">
                                        <div class="checkbox-item">
                                            <input type="checkbox" name="features[]" value="basic" checked id="feat-basic">
                                            <label for="feat-basic">Basic Features</label>
                                        </div>
                                        <div class="checkbox-item">
                                            <input type="checkbox" name="features[]" value="backup" id="feat-backup">
                                            <label for="feat-backup">Backup-Funktion</label>
                                        </div>
                                        <div class="checkbox-item">
                                            <input type="checkbox" name="features[]" value="export" id="feat-export">
                                            <label for="feat-export">Export-Funktion</label>
                                        </div>
                                        <div class="checkbox-item">
                                            <input type="checkbox" name="features[]" value="premium" id="feat-premium">
                                            <label for="feat-premium">Premium Features</label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" class="btn btn-success">🎯 Lizenz erstellen</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- Lizenz-Liste -->
        <div class="admin-section">
            <div class="section-header">
                <h2>📋 Lizenz-Übersicht</h2>
                <button class="btn btn-primary" onclick="location.reload()">
                    🔄 Aktualisieren
                </button>
            </div>
            <div class="section-content">
                <div class="table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Lizenzschlüssel</th>
                                <th>Kunde</th>
                                <th>Typ</th>
                                <th>Aktivierungen</th>
                                <th>Ablauf</th>
                                <th>Status</th>
                                <th>Erstellt</th>
                                <th>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $stmt = $pdo->query("
                                SELECT l.*, c.name as customer_name, c.email as customer_email,
                                       COUNT(la.id) as activation_count
                                FROM licenses l 
                                JOIN customers c ON l.customer_id = c.id 
                                LEFT JOIN license_activations la ON l.license_key = la.license_key AND la.status = 'active'
                                GROUP BY l.id 
                                ORDER BY l.created_at DESC
                            ");

                            while ($license = $stmt->fetch()):
                                $status_class = 'status-active';
                                $status_text = 'Aktiv';

                                if ($license['expires_at'] && strtotime($license['expires_at']) < time()) {
                                    $status_class = 'status-expired';
                                    $status_text = 'Abgelaufen';
                                } elseif ($license['status'] === 'suspended') {
                                    $status_class = 'status-suspended';
                                    $status_text = 'Gesperrt';
                                }
                            ?>
                                <tr>
                                    <td><span class="license-key-display"><?php echo $license['license_key']; ?></span></td>
                                    <td>
                                        <div class="customer-info">
                                            <span class="customer-name"><?php echo htmlspecialchars($license['customer_name']); ?></span>
                                            <span class="customer-email"><?php echo htmlspecialchars($license['customer_email']); ?></span>
                                        </div>
                                    </td>
                                    <td><?php echo ucfirst($license['license_type']); ?></td>
                                    <td>
                                        <div class="activation-info">
                                            <span class="activation-current"><?php echo $license['activation_count']; ?></span>
                                            <span>/</span>
                                            <span class="activation-max"><?php echo $license['max_activations']; ?></span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="expiry-info">
                                            <?php if ($license['expires_at']): ?>
                                                <?php
                                                $expires = strtotime($license['expires_at']);
                                                $now = time();
                                                $days_left = ($expires - $now) / (24 * 60 * 60);
                                                $expiry_class = '';

                                                if ($expires < $now) {
                                                    $expiry_class = 'expiry-overdue';
                                                } elseif ($days_left < 30) {
                                                    $expiry_class = 'expiry-soon';
                                                } else {
                                                    $expiry_class = 'expiry-date';
                                                }
                                                ?>
                                                <span class="<?php echo $expiry_class; ?>">
                                                    <?php echo date('d.m.Y', $expires); ?>
                                                </span>
                                            <?php else: ?>
                                                <span class="expiry-unlimited">Unbegrenzt</span>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                    <td><span class="status-badge <?php echo $status_class; ?>"><?php echo $status_text; ?></span></td>
                                    <td><?php echo date('d.m.Y H:i', strtotime($license['created_at'])); ?></td>
                                    <td>
                                        <div class="actions-group">
                                            <a href="license_details.php?key=<?php echo $license['license_key']; ?>" class="btn btn-sm btn-primary">
                                                📊 Details
                                            </a>
                                            <?php if ($license['status'] === 'active'): ?>
                                                <button class="btn btn-sm btn-danger" onclick="suspendLicense('<?php echo $license['license_key']; ?>')">
                                                    🚫 Sperren
                                                </button>
                                            <?php else: ?>
                                                <button class="btn btn-sm btn-success" onclick="activateLicense('<?php echo $license['license_key']; ?>')">
                                                    ✅ Aktivieren
                                                </button>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Aktivierungs-Log -->
        <div class="admin-section">
            <div class="section-header">
                <h2>📱 Aktuelle Aktivierungen</h2>
                <select onchange="filterActivations(this.value)" class="btn btn-primary">
                    <option value="">Alle anzeigen</option>
                    <option value="today">Heute</option>
                    <option value="week">Diese Woche</option>
                    <option value="month">Dieser Monat</option>
                </select>
            </div>
            <div class="section-content">
                <div class="table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Lizenz</th>
                                <th>Kunde</th>
                                <th>Hardware-ID</th>
                                <th>Erste Aktivierung</th>
                                <th>Letzte Validierung</th>
                                <th>App-Version</th>
                                <th>Validierungen</th>
                                <th>IP-Adresse</th>
                                <th>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $stmt = $pdo->query("
                                SELECT la.*, l.license_key, c.name as customer_name
                                FROM license_activations la
                                JOIN licenses l ON la.license_key = l.license_key
                                JOIN customers c ON l.customer_id = c.id
                                WHERE la.status = 'active'
                                ORDER BY la.last_validation DESC
                                LIMIT 50
                            ");

                            while ($activation = $stmt->fetch()):
                            ?>
                                <tr>
                                    <td><span class="license-key-display"><?php echo substr($activation['license_key'], 0, 10); ?>...</span></td>
                                    <td><?php echo htmlspecialchars($activation['customer_name']); ?></td>
                                    <td><span class="hardware-id-display"><?php echo substr($activation['hardware_id'], 0, 12); ?>...</span></td>
                                    <td><?php echo date('d.m.Y H:i', strtotime($activation['first_activation'])); ?></td>
                                    <td><?php echo date('d.m.Y H:i', strtotime($activation['last_validation'])); ?></td>
                                    <td><?php echo $activation['app_version']; ?></td>
                                    <td><?php echo $activation['validation_count']; ?></td>
                                    <td><?php echo $activation['last_ip']; ?></td>
                                    <td>
                                        <button class="btn btn-sm btn-danger" onclick="deactivateHardware('<?php echo $activation['license_key']; ?>', '<?php echo $activation['hardware_id']; ?>')">
                                            🗑️ Deaktivieren
                                        </button>
                                    </td>
                                </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script>
        // NEUE LOGOUT-FUNKTION
        function confirmLogout() {
            return confirm('🚪 Wirklich abmelden?\n\nIhre Sitzung wird beendet und Sie werden zur Login-Seite weitergeleitet.');
        }

        // Session-Timeout Warning (optional)
        let sessionWarningShown = false;
        setInterval(() => {
            // Nach 7.5 Stunden warnen (30 Min vor Ablauf)
            const sessionTime = <?php echo time() - ($_SESSION['admin_login_time'] ?? time()); ?>;
            if (sessionTime > 27000 && !sessionWarningShown) { // 7.5 Stunden
                sessionWarningShown = true;
                if (confirm('⚠️ Session-Warnung\n\nIhre Session läuft in 30 Minuten ab.\n\nMöchten Sie sie verlängern?')) {
                    // Seite neu laden verlängert die Session
                    location.reload();
                }
            }
        }, 60000); // Prüfe jede Minute

        function toggleSection(id) {
            const section = document.getElementById(id);
            const isActive = section.classList.contains('active');

            // Alle anderen Sektionen schließen
            document.querySelectorAll('.collapsible-content').forEach(el => {
                el.classList.remove('active');
            });

            // Aktuelle Sektion umschalten
            if (!isActive) {
                section.classList.add('active');
            }
        }

        function suspendLicense(licenseKey) {
            if (confirm(`Lizenz ${licenseKey} wirklich sperren?`)) {
                fetch('admin_actions.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'suspend',
                            license_key: licenseKey
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showNotification('success', 'Lizenz erfolgreich gesperrt');
                            setTimeout(() => location.reload(), 1500);
                        } else {
                            showNotification('error', 'Fehler: ' + data.error);
                        }
                    })
                    .catch(error => showNotification('error', 'Fehler: ' + error));
            }
        }

        function activateLicense(licenseKey) {
            if (confirm(`Lizenz ${licenseKey} wieder aktivieren?`)) {
                fetch('admin_actions.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'activate',
                            license_key: licenseKey
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showNotification('success', 'Lizenz erfolgreich aktiviert');
                            setTimeout(() => location.reload(), 1500);
                        } else {
                            showNotification('error', 'Fehler: ' + data.error);
                        }
                    })
                    .catch(error => showNotification('error', 'Fehler: ' + error));
            }
        }

        function deactivateHardware(licenseKey, hardwareId) {
            if (confirm(`Hardware-Aktivierung wirklich entfernen?\n\nLizenz: ${licenseKey}\nHardware: ${hardwareId}`)) {
                fetch('admin_actions.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            action: 'deactivate_hardware',
                            license_key: licenseKey,
                            hardware_id: hardwareId
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showNotification('success', 'Hardware-Aktivierung erfolgreich entfernt');
                            setTimeout(() => location.reload(), 1500);
                        } else {
                            showNotification('error', 'Fehler: ' + data.error);
                        }
                    })
                    .catch(error => showNotification('error', 'Fehler: ' + error));
            }
        }

        function filterActivations(filter) {
            console.log('Filter:', filter);
            location.reload();
        }

        function showNotification(type, message) {
            let container = document.querySelector('.notification-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'notification-container';
                document.body.appendChild(container);
            }

            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.remove()">×</button>
            `;

            container.appendChild(notification);
            setTimeout(() => notification.classList.add('show'), 100);

            setTimeout(() => {
                notification.classList.add('hide');
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        }

        // Auto-refresh alle 30 Sekunden
        setInterval(() => {
            if (!document.querySelector('.collapsible-content.active')) {
                location.reload();
            }
        }, 30000);

        // Smooth scrolling für bessere UX
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    </script>
</body>

</html>