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
        case 'suspended':
            $success_message = 'Lizenz erfolgreich gesperrt';
            break;
        case 'activated':
            $success_message = 'Lizenz erfolgreich aktiviert';
            break;
        case 'extended':
            $success_message = 'Lizenz erfolgreich verlängert';
            break;
        case 'deleted':
            $success_message = 'Lizenz erfolgreich gelöscht';
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
    <style>
        /* Erweiterte Styles für die Lizenz-Details Seite */
        :root {
            /* Neue Dark Mode Variablen integrieren */
            --clr-dark-a0: #000000;
            --clr-light-a0: #ffffff;

            /* Aktualisierte Theme primary colors */
            --clr-primary-a0: #83de8f;
            --clr-primary-a10: #92e29b;
            --clr-primary-a20: #a1e6a8;
            --clr-primary-a30: #afeab4;
            --clr-primary-a40: #bdedc0;
            --clr-primary-a50: #caf1cd;

            /* Aktualisierte Theme surface colors */
            --clr-surface-a0: #121212;
            --clr-surface-a10: #282828;
            --clr-surface-a20: #3f3f3f;
            --clr-surface-a30: #575757;
            --clr-surface-a40: #717171;
            --clr-surface-a50: #8b8b8b;

            /* Aktualisierte Theme tonal surface colors */
            --clr-surface-tonal-a0: #1d231d;
            --clr-surface-tonal-a10: #323832;
            --clr-surface-tonal-a20: #484d48;
            --clr-surface-tonal-a30: #606460;
            --clr-surface-tonal-a40: #787c78;
            --clr-surface-tonal-a50: #929591;
        }

        /* Details-Seite spezifische Styles */
        .details-header {
            background: linear-gradient(135deg, var(--clr-primary-a0) 0%, var(--clr-primary-a20) 100%);
            color: var(--clr-dark-a0);
            padding: 2.5rem;
            border-radius: 20px;
            margin-bottom: 2rem;
            position: relative;
            overflow: hidden;
            box-shadow: var(--shadow-lg);
        }

        .details-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
            animation: shimmer 4s infinite;
        }

        @keyframes shimmer {
            0% {
                transform: translateX(-100%);
            }

            100% {
                transform: translateX(100%);
            }
        }

        .details-header h1 {
            font-size: 2.2rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
            position: relative;
            z-index: 1;
        }

        .details-header p {
            font-size: 1.1rem;
            opacity: 0.9;
            position: relative;
            z-index: 1;
        }

        .license-key-hero {
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            background: rgba(0, 0, 0, 0.2);
            padding: 0.75rem 1.25rem;
            border-radius: 12px;
            font-size: 1.2rem;
            font-weight: 600;
            letter-spacing: 1px;
            margin-top: 1rem;
            border: 2px solid rgba(255, 255, 255, 0.2);
            position: relative;
            z-index: 1;
        }

        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .details-card {
            background: var(--clr-surface-a10);
            border-radius: 16px;
            padding: 2rem;
            border: 1px solid var(--border-color);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .details-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, var(--clr-primary-a0), var(--clr-primary-a30));
        }

        .details-card:hover {
            transform: translateY(-8px);
            box-shadow: var(--shadow-lg);
            border-color: var(--accent-primary);
        }

        .details-card h3 {
            margin: 0 0 1.5rem 0;
            color: var(--text-primary);
            font-size: 1.4rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
        }

        .info-item {
            background: var(--clr-surface-a20);
            padding: 1.25rem;
            border-radius: 12px;
            border: 1px solid var(--clr-surface-a30);
            transition: all 0.3s ease;
        }

        .info-item:hover {
            background: var(--clr-surface-tonal-a20);
            border-color: var(--clr-surface-tonal-a30);
        }

        .info-label {
            font-weight: 600;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .info-value {
            color: var(--text-primary);
            font-size: 1.1rem;
            font-weight: 500;
        }

        .license-key-display {
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            background: var(--clr-surface-tonal-a20);
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 1rem;
            border: 1px solid var(--clr-surface-tonal-a30);
            color: var(--clr-primary-a30);
            font-weight: 500;
        }

        .status-badge {
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-size: 0.9rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .status-active {
            background: rgba(131, 222, 143, 0.2);
            color: var(--accent-success);
            border: 1px solid rgba(131, 222, 143, 0.3);
        }

        .status-expired {
            background: rgba(239, 68, 68, 0.2);
            color: var(--accent-danger);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .status-suspended {
            background: rgba(245, 158, 11, 0.2);
            color: var(--accent-warning);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .status-icon {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
        }

        .feature-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1rem;
        }

        .feature-tag {
            background: var(--clr-surface-tonal-a20);
            color: var(--clr-primary-a30);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
            border: 1px solid var(--clr-surface-tonal-a30);
            transition: all 0.3s ease;
        }

        .feature-tag:hover {
            background: var(--clr-primary-a30);
            color: var(--clr-dark-a0);
            transform: translateY(-2px);
        }

        .details-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--clr-surface-a20);
            border-radius: 12px;
            overflow: hidden;
            margin-top: 1rem;
        }

        .details-table th,
        .details-table td {
            padding: 1rem 1.5rem;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        .details-table th {
            background: var(--clr-surface-a10);
            font-weight: 600;
            color: var(--text-primary);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .details-table tbody tr {
            transition: all 0.2s ease;
        }

        .details-table tbody tr:hover {
            background: var(--clr-surface-a10);
        }

        .hardware-id {
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 0.85rem;
            color: var(--text-muted);
            background: var(--clr-surface-a30);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
        }

        .actions-section {
            background: var(--clr-surface-a10);
            border-radius: 16px;
            padding: 2rem;
            border: 1px solid var(--border-color);
            margin-bottom: 2rem;
        }

        .actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-top: 1.5rem;
        }

        .action-group {
            background: var(--clr-surface-a20);
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid var(--clr-surface-a30);
        }

        .action-group h4 {
            color: var(--text-primary);
            margin: 0 0 1rem 0;
            font-size: 1.1rem;
            font-weight: 600;
        }

        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .activity-log {
            max-height: 500px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            background: var(--clr-surface-a20);
        }

        .activity-item {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            transition: all 0.2s ease;
        }

        .activity-item:hover {
            background: var(--clr-surface-a10);
        }

        .activity-item:last-child {
            border-bottom: none;
        }

        .activity-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .activity-action {
            font-weight: 600;
            color: var(--text-primary);
        }

        .activity-time {
            color: var(--text-muted);
            font-size: 0.875rem;
            margin-left: auto;
        }

        .activity-details {
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
        }

        .navigation-bar {
            background: var(--clr-surface-a20);
            padding: 1rem 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid var(--border-color);
        }

        .nav-breadcrumb {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .nav-breadcrumb a {
            color: var(--accent-primary);
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .nav-breadcrumb a:hover {
            color: var(--clr-primary-a10);
        }

        .refresh-status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted);
            font-size: 0.875rem;
        }

        .refresh-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent-success);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {

            0%,
            100% {
                opacity: 1;
            }

            50% {
                opacity: 0.5;
            }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .details-header {
                padding: 1.5rem;
            }

            .details-header h1 {
                font-size: 1.8rem;
            }

            .details-grid {
                grid-template-columns: 1fr;
                gap: 1rem;
            }

            .info-grid {
                grid-template-columns: 1fr;
            }

            .actions-grid {
                grid-template-columns: 1fr;
            }

            .navigation-bar {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }

            .details-table {
                font-size: 0.875rem;
            }

            .details-table th,
            .details-table td {
                padding: 0.75rem 0.5rem;
            }
        }

        @media (max-width: 480px) {
            .details-card {
                padding: 1rem;
            }

            .action-group {
                padding: 1rem;
            }

            .activity-item {
                padding: 0.75rem 1rem;
            }
        }

        /* Print Styles */
        @media print {

            .navigation-bar,
            .actions-section,
            .btn,
            .refresh-status {
                display: none !important;
            }

            body {
                background: white !important;
                color: black !important;
            }

            .details-card,
            .details-table,
            .activity-log {
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: 1px solid #ccc !important;
            }
        }
    </style>
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
            <p>Umfassende Informationen und Verwaltung</p>
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
            <div class="details-card">
                <h3>🔐 Lizenz-Informationen</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Lizenzschlüssel</div>
                        <div class="info-value">
                            <div class="license-key-display"><?php echo htmlspecialchars($license['license_key']); ?></div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Status</div>
                        <div class="info-value">
                            <?php
                            $status_class = 'status-active';
                            $status_text = 'Aktiv';
                            $status_icon = '●';

                            if ($license['expires_at'] && strtotime($license['expires_at']) < time()) {
                                $status_class = 'status-expired';
                                $status_text = 'Abgelaufen';
                                $status_icon = '●';
                            } elseif ($license['status'] === 'suspended') {
                                $status_class = 'status-suspended';
                                $status_text = 'Gesperrt';
                                $status_icon = '●';
                            }
                            ?>
                            <span class="status-badge <?php echo $status_class; ?>">
                                <span class="status-icon"></span>
                                <?php echo $status_text; ?>
                            </span>
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
                                <span style="color: var(--accent-success);">Unbegrenzt</span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Aktuelle Aktivierungen</div>
                        <div class="info-value">
                            <?php echo count(array_filter($activations, function ($a) {
                                return $a['status'] === 'active';
                            })); ?>
                        </div>
                    </div>
                </div>
            </div>

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

        <div class="details-card">
            <h3>⭐ Features</h3>
            <div class="feature-grid">
                <?php foreach ($features as $feature): ?>
                    <span class="feature-tag"><?php echo htmlspecialchars($feature); ?></span>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="details-card">
            <h3>📱 Aktivierungen (<?php echo count($activations); ?>)</h3>
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
                            <th>Status</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($activations as $activation): ?>
                            <tr>
                                <td>
                                    <span class="hardware-id"><?php echo htmlspecialchars(substr($activation['hardware_id'], 0, 16) . '...'); ?></span>
                                </td>
                                <td><?php echo date('d.m.Y H:i', strtotime($activation['first_activation'])); ?></td>
                                <td><?php echo date('d.m.Y H:i', strtotime($activation['last_validation'])); ?></td>
                                <td><?php echo htmlspecialchars($activation['app_version']); ?></td>
                                <td><?php echo $activation['validation_count']; ?></td>
                                <td><?php echo htmlspecialchars($activation['last_ip']); ?></td>
                                <td>
                                    <span class="status-badge <?php echo $activation['status'] === 'active' ? 'status-active' : 'status-suspended'; ?>">
                                        <span class="status-icon"></span>
                                        <?php echo $activation['status'] === 'active' ? 'Aktiv' : 'Deaktiviert'; ?>
                                    </span>
                                </td>
                                <td>
                                    <?php if ($activation['status'] === 'active'): ?>
                                        <button class="btn btn-sm btn-danger" onclick="deactivateHardware('<?php echo htmlspecialchars($activation['hardware_id']); ?>')">
                                            🗑️ Deaktivieren
                                        </button>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>

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
                    <h4>Lizenz-Aktionen</h4>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="extendLicense()">📅 Verlängern</button>
                        <button class="btn btn-warning" onclick="changeActivations()">🔢 Max. Aktivierungen</button>
                    </div>
                </div>

                <div class="action-group">
                    <h4>Erweiterte Aktionen</h4>
                    <div class="action-buttons">
                        <button class="btn btn-warning" onclick="regenerateKey()">🔄 Neuen Schlüssel</button>
                        <button class="btn btn-danger" onclick="deleteLicense()">🗑️ Lizenz löschen</button>
                    </div>
                </div>

                <div class="action-group">
                    <h4>Navigation</h4>
                    <div class="action-buttons">
                        <a href="index.php" class="btn btn-secondary">← Zurück zur Übersicht</a>
                        <button class="btn btn-primary" onclick="location.reload()">🔄 Aktualisieren</button>
                    </div>
                </div>
            </div>
        </div>

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

        function extendLicense() {
            const newExpiry = prompt('Neues Ablaufdatum (YYYY-MM-DD):', '<?php echo date('Y-m-d', strtotime('+1 year')); ?>');
            if (newExpiry && newExpiry.match(/^\d{4}-\d{2}-\d{2}$/)) {
                adminAction('extend_license', {
                    new_expiry: newExpiry
                });
            }
        }

        function changeActivations() {
            const current = <?php echo $license['max_activations']; ?>;
            const newMax = prompt(`Neue maximale Anzahl Aktivierungen (aktuell: ${current}):`, current);
            if (newMax && !isNaN(newMax) && newMax >= 1 && newMax <= 10) {
                adminAction('change_activations', {
                    new_max: parseInt(newMax)
                });
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
                adminAction('deactivate_hardware', {
                    hardware_id: hardwareId
                });
            }
        }

        function adminAction(action, extraData = {}) {
            const data = {
                action: action,
                license_key: licenseKey,
                ...extraData
            };

            // Loading-Zustand anzeigen
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
                        if (action === 'delete_license') {
                            setTimeout(() => {
                                window.location.href = 'index.php?success=deleted';
                            }, 2000);
                        } else if (action === 'regenerate_key' && result.new_key) {
                            showNotification('info', '🔑 Neuer Lizenzschlüssel: ' + result.new_key);
                            setTimeout(() => {
                                window.location.href = 'license_details.php?key=' + result.new_key;
                            }, 3000);
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
            // Erstelle Notification-Container falls nicht vorhanden
            let container = document.querySelector('.notification-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'notification-container';
                document.body.appendChild(container);
            }

            // Erstelle Notification
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.innerHTML = `
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.remove()">×</button>
            `;

            container.appendChild(notification);

            // Animation
            setTimeout(() => notification.classList.add('show'), 100);

            // Auto-Remove nach 5 Sekunden (außer bei Info)
            if (type !== 'info') {
                setTimeout(() => {
                    notification.classList.add('hide');
                    setTimeout(() => notification.remove(), 300);
                }, 5000);
            }
        }

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

        // Auto-refresh Indikator aktualisieren
        setInterval(() => {
            const indicator = document.querySelector('.refresh-indicator');
            if (indicator) {
                indicator.style.background = 'var(--accent-success)';
                setTimeout(() => {
                    indicator.style.background = 'var(--text-muted)';
                }, 200);
            }
        }, 10000);

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        location.reload();
                        break;
                    case 'b':
                        e.preventDefault();
                        window.location.href = 'index.php';
                        break;
                }
            }
        });
    </script>
</body>

</html>