<?php
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

// Aktivierungen laden
$stmt = $pdo->prepare("
    SELECT * FROM license_activations 
    WHERE license_key = ? 
    ORDER BY last_validation DESC
");
$stmt->execute([$license_key]);
$activations = $stmt->fetchAll();

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
        case 'suspended': $success_message = 'Lizenz erfolgreich gesperrt'; break;
        case 'activated': $success_message = 'Lizenz erfolgreich aktiviert'; break;
        case 'extended': $success_message = 'Lizenz erfolgreich verlängert'; break;
        case 'deleted': $success_message = 'Lizenz erfolgreich gelöscht'; break;
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
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card h3 { margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .info-item { padding: 15px; background: #f8f9fa; border-radius: 6px; }
        .info-label { font-weight: bold; color: #666; margin-bottom: 5px; }
        .info-value { color: #333; }
        .license-key { font-family: monospace; background: #e9ecef; padding: 8px; border-radius: 4px; font-size: 1.1em; }
        .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.9em; font-weight: bold; }
        .status-active { background: #d4edda; color: #155724; }
        .status-suspended { background: #fff3cd; color: #856404; }
        .status-expired { background: #f8d7da; color: #721c24; }
        .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin: 5px; text-decoration: none; display: inline-block; }
        .btn-primary { background: #007bff; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-warning { background: #ffc107; color: #212529; }
        .btn-secondary { background: #6c757d; color: white; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: bold; }
        .hardware-id { font-family: monospace; font-size: 0.9em; }
        .feature-list { display: flex; flex-wrap: wrap; gap: 10px; }
        .feature-tag { background: #e3f2fd; color: #1565c0; padding: 6px 12px; border-radius: 20px; font-size: 0.9em; }
        .activity-item { padding: 10px; border-left: 3px solid #007bff; margin-bottom: 10px; background: #f8f9fa; }
        .activity-time { color: #666; font-size: 0.9em; }
        .alert { padding: 15px; margin: 20px 0; border-radius: 4px; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Lizenz-Details</h1>
            <p>Detaillierte Informationen zu Lizenz: <span class="license-key"><?php echo htmlspecialchars($license_key); ?></span></p>
        </div>

        <?php if ($success_message): ?>
            <div class="alert alert-success">✅ <?php echo $success_message; ?></div>
        <?php endif; ?>
        
        <?php if ($error_message): ?>
            <div class="alert alert-danger">❌ <?php echo $error_message; ?></div>
        <?php endif; ?>

        <div class="card">
            <h3>🔐 Lizenz-Informationen</h3>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Lizenzschlüssel</div>
                    <div class="info-value license-key"><?php echo htmlspecialchars($license['license_key']); ?></div>
                </div>
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
                        <span class="status-badge <?php echo $status_class; ?>"><?php echo $status_text; ?></span>
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">Lizenz-Typ</div>
                    <div class="info-value"><?php echo ucfirst($license['license_type']); ?></div>
                </div>
                <div class="info-item">
                    <div class="info-label">Max. Aktivierungen</div>
                    <div class="info-value"><?php echo $license['max_activations']; ?></div>
                </div>
                <div class="info-item">
                    <div class="info-label">Preis</div>
                    <div class="info-value"><?php echo number_format($license['price'], 2); ?>€</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Erstellt</div>
                    <div class="info-value"><?php echo date('d.m.Y H:i', strtotime($license['created_at'])); ?></div>
                </div>
                <div class="info-item">
                    <div class="info-label">Ablaufdatum</div>
                    <div class="info-value">
                        <?php if ($license['expires_at']): ?>
                            <?php echo date('d.m.Y H:i', strtotime($license['expires_at'])); ?>
                        <?php else: ?>
                            <span style="color: #28a745;">Unbegrenzt</span>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">Aktuelle Aktivierungen</div>
                    <div class="info-value"><?php echo count(array_filter($activations, function($a) { return $a['status'] === 'active'; })); ?></div>
                </div>
            </div>
        </div>

        <div class="card">
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

        <div class="card">
            <h3>⭐ Features</h3>
            <div class="feature-list">
                <?php foreach ($features as $feature): ?>
                    <span class="feature-tag"><?php echo htmlspecialchars($feature); ?></span>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="card">
            <h3>📱 Aktivierungen (<?php echo count($activations); ?>)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Hardware-ID</th>
                        <th>Erste Aktivierung</th>
                        <th>Letzte Validierung</th>
                        <th>App-Version</th>
                        <th>Validierungen</th>
                        <th>IP-Adresse</th>
                        <th>Status</th>
                        <th>Aktionen</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($activations as $activation): ?>
                    <tr>
                        <td><span class="hardware-id"><?php echo htmlspecialchars(substr($activation['hardware_id'], 0, 16) . '...'); ?></span></td>
                        <td><?php echo date('d.m.Y H:i', strtotime($activation['first_activation'])); ?></td>
                        <td><?php echo date('d.m.Y H:i', strtotime($activation['last_validation'])); ?></td>
                        <td><?php echo htmlspecialchars($activation['app_version']); ?></td>
                        <td><?php echo $activation['validation_count']; ?></td>
                        <td><?php echo htmlspecialchars($activation['last_ip']); ?></td>
                        <td>
                            <span class="status-badge <?php echo $activation['status'] === 'active' ? 'status-active' : 'status-suspended'; ?>">
                                <?php echo $activation['status'] === 'active' ? 'Aktiv' : 'Deaktiviert'; ?>
                            </span>
                        </td>
                        <td>
                            <?php if ($activation['status'] === 'active'): ?>
                                <button class="btn btn-danger" onclick="deactivateHardware('<?php echo htmlspecialchars($activation['hardware_id']); ?>')">
                                    Deaktivieren
                                </button>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="card">
            <h3>⚙️ Verwaltungs-Aktionen</h3>
            <div class="actions-grid">
                <div>
                    <h4>Status-Aktionen</h4>
                    <?php if ($license['status'] === 'active'): ?>
                        <button class="btn btn-warning" onclick="suspendLicense()">🚫 Lizenz sperren</button>
                    <?php else: ?>
                        <button class="btn btn-success" onclick="activateLicense()">✅ Lizenz aktivieren</button>
                    <?php endif; ?>
                </div>
                
                <div>
                    <h4>Lizenz-Aktionen</h4>
                    <button class="btn btn-primary" onclick="extendLicense()">📅 Verlängern</button>
                    <button class="btn btn-warning" onclick="changeActivations()">🔢 Max. Aktivierungen</button>
                </div>
                
                <div>
                    <h4>Erweiterte Aktionen</h4>
                    <button class="btn btn-warning" onclick="regenerateKey()">🔄 Neuen Schlüssel</button>
                    <button class="btn btn-danger" onclick="deleteLicense()">🗑️ Lizenz löschen</button>
                </div>
                
                <div>
                    <h4>Navigation</h4>
                    <a href="index.php" class="btn btn-secondary">← Zurück zur Übersicht</a>
                </div>
            </div>
        </div>

        <div class="card">
            <h3>📋 Aktivitäts-Log (Letzte 50)</h3>
            <div style="max-height: 400px; overflow-y: auto;">
                <?php foreach ($activity_log as $log): ?>
                    <div class="activity-item">
                        <strong><?php echo htmlspecialchars($log['action']); ?></strong>
                        <span class="activity-time"><?php echo date('d.m.Y H:i:s', strtotime($log['created_at'])); ?></span>
                        <div style="margin-top: 5px; font-size: 0.9em; color: #555;">
                            IP: <?php echo htmlspecialchars($log['ip_address']); ?> | 
                            Details: <?php echo htmlspecialchars(substr($log['details'], 0, 100)); ?>
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

        function regenerateKey() {
            if (confirm('Neuen Lizenzschlüssel generieren?\n\nAlle bestehenden Aktivierungen werden übertragen.')) {
                adminAction('regenerate_key');
            }
        }

        function deleteLicense() {
            if (confirm('Lizenz WIRKLICH LÖSCHEN?\n\nDiese Aktion kann nicht rückgängig gemacht werden!\nAlle Daten und Aktivierungen werden gelöscht!')) {
                if (confirm('Sind Sie absolut sicher?\n\nLizenz: ' + licenseKey)) {
                    adminAction('delete_license');
                }
            }
        }

        function deactivateHardware(hardwareId) {
            if (confirm(`Hardware-Aktivierung wirklich entfernen?\n\nHardware-ID: ${hardwareId}`)) {
                adminAction('deactivate_hardware', { hardware_id: hardwareId });
            }
        }

        function adminAction(action, extraData = {}) {
            const data = {
                action: action,
                license_key: licenseKey,
                ...extraData
            };

            fetch('admin_actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    alert('✅ ' + result.message);
                    if (action === 'delete_license') {
                        window.location.href = 'index.php?success=deleted';
                    } else if (action === 'regenerate_key' && result.new_key) {
                        alert('🔑 Neuer Lizenzschlüssel: ' + result.new_key);
                        window.location.href = 'license_details.php?key=' + result.new_key;
                    } else {
                        location.reload();
                    }
                } else {
                    alert('❌ Fehler: ' + result.error);
                }
            })
            .catch(error => {
                alert('❌ Netzwerkfehler: ' + error.message);
            });
        }
    </script>
</body>
</html>

?>