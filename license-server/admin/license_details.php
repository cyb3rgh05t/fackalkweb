<?php
require_once 'auth.php';
requireLogin(); // Diese Zeile schützt die Seite
require_once '../config/database.php';

$license_key = $_GET['key'] ?? '';

if (empty($license_key)) {
    header('Location: index.php?error=Lizenzschlüssel fehlt');
    exit;
}

// Lizenz-Informationen laden
$stmt = $pdo->prepare("
    SELECT l.*, c.name as customer_name, c.email as customer_email, c.company
    FROM licenses l 
    JOIN customers c ON l.customer_id = c.id 
    WHERE l.license_key = ?
");
$stmt->execute([$license_key]);
$license = $stmt->fetch();

if (!$license) {
    header('Location: index.php?error=Lizenz nicht gefunden');
    exit;
}

// Alle Aktivierungen laden (aktive UND deaktivierte)
$stmt = $pdo->prepare("
    SELECT * FROM license_activations 
    WHERE license_key = ? 
    ORDER BY 
        CASE WHEN status = 'active' THEN 1 
             WHEN status = 'deactivated' THEN 2 
             ELSE 3 END,
        last_validation DESC
");
$stmt->execute([$license_key]);
$all_activations = $stmt->fetchAll();

// Aktivierungen nach Status trennen
$active_activations = array_filter($all_activations, function($a) { return $a['status'] === 'active'; });
$deactivated_activations = array_filter($all_activations, function($a) { return $a['status'] === 'deactivated'; });

// Features laden
$stmt = $pdo->prepare("
    SELECT feature_name FROM license_features 
    WHERE license_key = ?
");
$stmt->execute([$license_key]);
$features = $stmt->fetchAll(PDO::FETCH_COLUMN);

// Aktivitäts-Log laden
$stmt = $pdo->prepare("
    SELECT * FROM activity_log 
    WHERE JSON_EXTRACT(details, '$.license_key') = ? OR details LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
");
$stmt->execute([$license_key, '%' . $license_key . '%']);
$activity_log = $stmt->fetchAll();

// Success/Error Messages
$success_message = '';
$error_message = '';

if (isset($_GET['success'])) {
    switch ($_GET['success']) {
        case 'suspended':
            $success_message = 'Lizenz erfolgreich gesperrt';
            break;
        case 'activated':
            $success_message = 'Lizenz erfolgreich aktiviert';
            break;
        case 'hardware_reactivated':
            $success_message = 'Hardware-ID erfolgreich reaktiviert';
            break;
        case 'hardware_deleted':
            $success_message = 'Hardware-ID erfolgreich gelöscht';
            break;
    }
}

if (isset($_GET['error'])) {
    $error_message = htmlspecialchars($_GET['error']);
}
?>

<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lizenz-Details: <?php echo htmlspecialchars($license_key); ?></title>
    <link rel="stylesheet" href="../assets/style.css">
</head>

<body>
    <div class="container">
        <div class="navigation-bar">
            <div class="nav-breadcrumb">
                <a href="index.php">📊 Dashboard</a>
                <span>›</span>
                <span>Lizenz-Details</span>
            </div>
            <div class="refresh-status">
                <div class="refresh-indicator"></div>
                <span>Live-Daten</span>
            </div>
        </div>

        <div class="details-header">
            <h1>📊 Lizenz-Details</h1>
            <p>Umfassende Informationen und Hardware-ID Management</p>
            <div class="license-key-hero"><?php echo htmlspecialchars($license_key); ?></div>
        </div>

        <?php if ($success_message): ?>
            <div class="alert alert-success">
                <span>✅ <?php echo $success_message; ?></span>
            </div>
        <?php endif; ?>

        <?php if ($error_message): ?>
            <div class="alert alert-danger">
                <span>❌ <?php echo $error_message; ?></span>
            </div>
        <?php endif; ?>

        <div class="details-grid">
            <!-- Lizenz-Informationen Card -->
            <div class="details-card">
                <h3>🔐 Lizenz-Informationen</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Status</div>
                        <div class="info-value">
                            <?php
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
                            <span class="status-badge <?php echo $status_class; ?>">
                                <span class="status-icon"></span>
                                <?php echo $status_text; ?>
                            </span>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Aktivierungen</div>
                        <div class="info-value">
                            <span style="color: var(--accent-primary); font-weight: bold;">
                                <?php echo count($active_activations); ?>
                            </span>
                            / <?php echo $license['max_activations']; ?>
                            <?php if (count($deactivated_activations) > 0): ?>
                                <br><small style="color: var(--text-muted);">
                                    (<?php echo count($deactivated_activations); ?> deaktiviert)
                                </small>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Lizenz-Typ</div>
                        <div class="info-value"><?php echo ucfirst($license['license_type']); ?></div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Ablaufdatum</div>
                        <div class="info-value">
                            <?php if ($license['expires_at']): ?>
                                <?php echo date('d.m.Y H:i', strtotime($license['expires_at'])); ?>
                            <?php else: ?>
                                <span style="color: var(--accent-success);">Unbegrenzt</span>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Kunden-Informationen Card -->
            <div class="details-card">
                <h3>👤 Kunden-Informationen</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Name</div>
                        <div class="info-value"><?php echo htmlspecialchars($license['customer_name']); ?></div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">E-Mail</div>
                        <div class="info-value"><?php echo htmlspecialchars($license['customer_email']); ?></div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Firma</div>
                        <div class="info-value"><?php echo htmlspecialchars($license['company'] ?: 'Keine Angabe'); ?></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Features Card -->
        <div class="details-card">
            <h3>⭐ Features</h3>
            <div class="feature-grid">
                <?php foreach ($features as $feature): ?>
                    <span class="feature-tag"><?php echo htmlspecialchars($feature); ?></span>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- AKTIVE Aktivierungen -->
        <?php if (!empty($active_activations)): ?>
        <div class="details-card">
            <h3>✅ Aktive Hardware-IDs (<?php echo count($active_activations); ?>)</h3>
            <div class="table-container">
                <table class="details-table">
                    <thead>
                        <tr>
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
                        <?php foreach ($active_activations as $activation): ?>
                            <tr>
                                <td>
                                    <span class="hardware-id" title="<?php echo htmlspecialchars($activation['hardware_id']); ?>">
                                        <?php echo htmlspecialchars(substr($activation['hardware_id'], 0, 16) . '...'); ?>
                                    </span>
                                </td>
                                <td><?php echo date('d.m.Y H:i', strtotime($activation['first_activation'])); ?></td>
                                <td><?php echo date('d.m.Y H:i', strtotime($activation['last_validation'])); ?></td>
                                <td><?php echo htmlspecialchars($activation['app_version']); ?></td>
                                <td><?php echo $activation['validation_count']; ?></td>
                                <td><?php echo htmlspecialchars($activation['last_ip']); ?></td>
                                <td>
                                    <button class="btn btn-sm btn-warning" onclick="deactivateHardware('<?php echo htmlspecialchars($activation['hardware_id']); ?>')">
                                        🚫 Deaktivieren
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteHardware('<?php echo htmlspecialchars($activation['hardware_id']); ?>')">
                                        🗑️ Löschen
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <?php endif; ?>

        <!-- DEAKTIVIERTE Hardware-IDs (NEU!) -->
        <?php if (!empty($deactivated_activations)): ?>
        <div class="details-card" style="border-left: 4px solid var(--accent-warning);">
            <h3>🚫 Deaktivierte Hardware-IDs (<?php echo count($deactivated_activations); ?>)</h3>
            <div class="alert alert-info">
                <span>💡 Diese Hardware-IDs wurden deaktiviert, können aber reaktiviert werden, falls noch Plätze verfügbar sind.</span>
            </div>
            <div class="table-container">
                <table class="details-table">
                    <thead>
                        <tr>
                            <th>Hardware-ID</th>
                            <th>Erste Aktivierung</th>
                            <th>Deaktiviert am</th>
                            <th>Letzte App-Version</th>
                            <th>Validierungen</th>
                            <th>Letzte IP</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($deactivated_activations as $activation): ?>
                            <tr style="background: rgba(245, 158, 11, 0.05);">
                                <td>
                                    <span class="hardware-id" title="<?php echo htmlspecialchars($activation['hardware_id']); ?>" style="color: var(--accent-warning);">
                                        <?php echo htmlspecialchars(substr($activation['hardware_id'], 0, 16) . '...'); ?>
                                    </span>
                                </td>
                                <td><?php echo date('d.m.Y H:i', strtotime($activation['first_activation'])); ?></td>
                                <td>
                                    <?php if ($activation['deactivated_at']): ?>
                                        <?php echo date('d.m.Y H:i', strtotime($activation['deactivated_at'])); ?>
                                    <?php else: ?>
                                        <span style="color: var(--text-muted);">Unbekannt</span>
                                    <?php endif; ?>
                                </td>
                                <td><?php echo htmlspecialchars($activation['app_version']); ?></td>
                                <td><?php echo $activation['validation_count']; ?></td>
                                <td><?php echo htmlspecialchars($activation['last_ip']); ?></td>
                                <td>
                                    <?php 
                                    $can_reactivate = count($active_activations) < $license['max_activations'];
                                    ?>
                                    <?php if ($can_reactivate): ?>
                                        <button class="btn btn-sm btn-success" onclick="reactivateHardware('<?php echo htmlspecialchars($activation['hardware_id']); ?>')">
                                            ✅ Reaktivieren
                                        </button>
                                    <?php else: ?>
                                        <button class="btn btn-sm btn-secondary" disabled title="Maximale Anzahl Aktivierungen erreicht">
                                            ✅ Reaktivieren
                                        </button>
                                    <?php endif; ?>
                                    <button class="btn btn-sm btn-danger" onclick="deleteHardware('<?php echo htmlspecialchars($activation['hardware_id']); ?>')">
                                        🗑️ Löschen
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php if (!$can_reactivate): ?>
                <div class="alert alert-warning">
                    <span>⚠️ Reaktivierung nicht möglich: Maximale Anzahl Aktivierungen (<?php echo $license['max_activations']; ?>) bereits erreicht.</span>
                </div>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <!-- Verwaltungs-Aktionen -->
        <div class="actions-section">
            <h3>⚙️ Verwaltungs-Aktionen</h3>
            <div class="actions-grid">
                <div class="action-group">
                    <h4>Status-Aktionen</h4>
                    <div class="action-buttons">
                        <?php if ($license['status'] === 'active'): ?>
                            <button class="btn btn-warning" onclick="suspendLicense()">🚫 Lizenz sperren</button>
                        <?php else: ?>
                            <button class="btn btn-success" onclick="activateLicense()">✅ Lizenz aktivieren</button>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="action-group">
                    <h4>Hardware Management</h4>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="refreshHardwareStatus()">🔄 Hardware-Status aktualisieren</button>
                        <?php if (count($deactivated_activations) > 0): ?>
                            <button class="btn btn-success" onclick="reactivateAllPossible()">♻️ Alle reaktivieren (falls möglich)</button>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="action-group">
                    <h4>Lizenz-Aktionen</h4>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="extendLicense()">📅 Verlängern</button>
                        <button class="btn btn-warning" onclick="changeActivations()">🔢 Max. Aktivierungen</button>
                    </div>
                </div>

                <div class="action-group">
                    <h4>Navigation</h4>
                    <div class="action-buttons">
                        <a href="index.php" class="btn btn-secondary">← Zurück zur Übersicht</a>
                        <button class="btn btn-primary" onclick="location.reload()">🔄 Seite aktualisieren</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Aktivitäts-Log -->
        <div class="details-card">
            <h3>📋 Aktivitäts-Log (Letzte 50)</h3>
            <div class="activity-log">
                <?php foreach ($activity_log as $log): ?>
                    <div class="activity-item">
                        <div class="activity-header">
                            <span class="activity-action"><?php echo htmlspecialchars($log['action']); ?></span>
                            <span class="activity-time"><?php echo date('d.m.Y H:i:s', strtotime($log['created_at'])); ?></span>
                        </div>
                        <div class="activity-details">
                            <strong>IP:</strong> <?php echo htmlspecialchars($log['ip_address']); ?> |
                            <strong>Details:</strong> <?php echo htmlspecialchars(substr($log['details'], 0, 100)); ?>
                            <?php if (strlen($log['details']) > 100): ?>...<?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

    <script>
        const licenseKey = '<?php echo $license_key; ?>';

        function suspendLicense() {
            if (confirm('Lizenz wirklich sperren?')) {
                adminAction('suspend');
            }
        }

        function activateLicense() {
            if (confirm('Lizenz wieder aktivieren?')) {
                adminAction('activate');
            }
        }

        function deactivateHardware(hardwareId) {
            if (confirm(`Hardware-ID deaktivieren?\n\nHardware-ID: ${hardwareId.substring(0, 16)}...\n\nSie kann später reaktiviert werden.`)) {
                adminAction('deactivate_hardware', { hardware_id: hardwareId });
            }
        }

        function reactivateHardware(hardwareId) {
            if (confirm(`Hardware-ID reaktivieren?\n\nHardware-ID: ${hardwareId.substring(0, 16)}...\n\nSie wird wieder als aktiv markiert.`)) {
                adminAction('reactivate_hardware', { hardware_id: hardwareId });
            }
        }

        function deleteHardware(hardwareId) {
            if (confirm(`Hardware-ID PERMANENT löschen?\n\nHardware-ID: ${hardwareId.substring(0, 16)}...\n\nDiese Aktion kann NICHT rückgängig gemacht werden!`)) {
                if (confirm('Sind Sie absolut sicher? Alle Daten zu dieser Hardware-ID werden gelöscht!')) {
                    adminAction('delete_hardware', { hardware_id: hardwareId });
                }
            }
        }

        function extendLicense() {
            const newExpiry = prompt('Neues Ablaufdatum (YYYY-MM-DD):', '<?php echo date('Y-m-d', strtotime('+1 year')); ?>');
            if (newExpiry && newExpiry.match(/^\d{4}-\d{2}-\d{2}$/)) {
                adminAction('extend_license', { new_expiry: newExpiry });
            }
        }

        function changeActivations() {
            const current = <?php echo $license['max_activations']; ?>;
            const newMax = prompt(`Neue maximale Anzahl Aktivierungen (aktuell: ${current}):`, current);
            if (newMax && !isNaN(newMax) && newMax >= 1 && newMax <= 10) {
                adminAction('change_activations', { new_max: parseInt(newMax) });
            }
        }

        function refreshHardwareStatus() {
            showNotification('info', 'Hardware-Status wird aktualisiert...');
            adminAction('get_hardware_status');
        }

        function reactivateAllPossible() {
            const deactivatedCount = <?php echo count($deactivated_activations); ?>;
            const activeCount = <?php echo count($active_activations); ?>;
            const maxActivations = <?php echo $license['max_activations']; ?>;
            const possibleReactivations = Math.min(deactivatedCount, maxActivations - activeCount);
            
            if (possibleReactivations <= 0) {
                showNotification('warning', 'Keine Reaktivierungen möglich - Maximum bereits erreicht');
                return;
            }
            
            if (confirm(`${possibleReactivations} Hardware-ID(s) reaktivieren?\n\nEs werden die zuletzt verwendeten Hardware-IDs reaktiviert.`)) {
                // Hier würde eine spezielle Funktion implementiert werden
                showNotification('info', 'Funktion in Entwicklung - bitte einzeln reaktivieren');
            }
        }

        function adminAction(action, extraData = {}) {
            const data = {
                action: action,
                license_key: licenseKey,
                ...extraData
            };

            showNotification('info', 'Aktion wird ausgeführt...');

            fetch('admin_actions.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        showNotification('success', result.message);
                        
                        // Spezielle Behandlung für verschiedene Aktionen
                        if (action === 'get_hardware_status') {
                            console.log('Hardware Status:', result.hardware);
                            showNotification('info', `${result.count} Hardware-ID(s) geladen`);
                        } else if (action.includes('hardware')) {
                            // Bei Hardware-Aktionen: Seite nach kurzer Zeit neu laden
                            setTimeout(() => location.reload(), 1500);
                        } else {
                            setTimeout(() => location.reload(), 2000);
                        }
                    } else {
                        showNotification('error', result.error);
                    }
                })
                .catch(error => {
                    showNotification('error', 'Netzwerkfehler: ' + error.message);
                });
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

            if (type !== 'info') {
                setTimeout(() => {
                    notification.classList.add('hide');
                    setTimeout(() => notification.remove(), 300);
                }, 5000);
            }
        }

        // Auto-refresh Indikator
        setInterval(() => {
            const indicator = document.querySelector('.refresh-indicator');
            if (indicator) {
                indicator.style.background = 'var(--accent-success)';
                setTimeout(() => {
                    indicator.style.background = 'var(--text-muted)';
                }, 200);
            }
        }, 10000);
    </script>
</body>
</html>