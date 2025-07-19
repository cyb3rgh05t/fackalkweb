<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔐 KFZ-App Lizenz-Verwaltung</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }

        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            text-align: center;
            transition: transform 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
        }

        .stat-number {
            font-size: 3em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }

        .stat-label {
            color: #666;
            text-transform: uppercase;
            font-size: 0.9em;
            letter-spacing: 1px;
        }

        .section {
            background: white;
            margin: 30px 0;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        .section-header {
            background: #f8f9fa;
            padding: 20px 30px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .section-header h2 {
            color: #333;
            font-size: 1.5em;
        }

        .section-content {
            padding: 30px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        th,
        td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }

        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
            position: sticky;
            top: 0;
        }

        tr:hover {
            background: #f8f9fa;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9em;
            font-weight: 500;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            margin: 3px;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover {
            background: #5a6fd8;
            transform: translateY(-2px);
        }

        .btn-danger {
            background: #ff6b6b;
            color: white;
        }

        .btn-danger:hover {
            background: #ff5252;
            transform: translateY(-2px);
        }

        .btn-success {
            background: #51cf66;
            color: white;
        }

        .btn-success:hover {
            background: #40c057;
            transform: translateY(-2px);
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .form-group {
            margin: 15px 0;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #555;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1em;
            transition: border-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
        }

        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-active {
            background: #d4edda;
            color: #155724;
        }

        .status-expired {
            background: #f8d7da;
            color: #721c24;
        }

        .status-suspended {
            background: #fff3cd;
            color: #856404;
        }

        .license-key {
            font-family: 'Courier New', monospace;
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            font-size: 0.9em;
            border: 1px solid #e9ecef;
        }

        .hardware-id {
            font-family: 'Courier New', monospace;
            color: #6c757d;
            font-size: 0.85em;
        }

        .alert {
            padding: 15px;
            margin: 20px 0;
            border-radius: 8px;
            border: 1px solid transparent;
        }

        .alert-success {
            color: #155724;
            background: #d4edda;
            border-color: #c3e6cb;
        }

        .alert-danger {
            color: #721c24;
            background: #f8d7da;
            border-color: #f5c6cb;
        }

        .alert-info {
            color: #0c5460;
            background: #d1ecf1;
            border-color: #bee5eb;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .stats {
                grid-template-columns: 1fr;
            }

            .form-grid {
                grid-template-columns: 1fr;
            }

            .section-content {
                padding: 20px;
            }
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <h1>🔐 KFZ-App Lizenz-Verwaltung</h1>
            <p>Zentrale Verwaltung aller App-Lizenzen</p>
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

        <div class="stats">
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

        <!-- Neue Lizenz erstellen -->
        <div class="section">
            <div class="section-header">
                <h2>🆕 Neue Lizenz erstellen</h2>
                <button class="btn btn-primary" onclick="toggleSection('create-license')">
                    Lizenz erstellen
                </button>
            </div>
            <div class="section-content" id="create-license" style="display:none;">
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
                    <div class="form-group">
                        <label>Features:</label>
                        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" name="features[]" value="basic" checked>
                                Basic Features
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" name="features[]" value="backup">
                                Backup-Funktion
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" name="features[]" value="export">
                                Export-Funktion
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" name="features[]" value="premium">
                                Premium Features
                            </label>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-success">🎯 Lizenz erstellen</button>
                </form>
            </div>
        </div>

        <!-- Lizenz-Liste -->
        <div class="section">
            <div class="section-header">
                <h2>📋 Lizenz-Übersicht</h2>
                <button class="btn btn-primary" onclick="location.reload()">
                    🔄 Aktualisieren
                </button>
            </div>
            <div class="section-content">
                <table>
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
                                <td><span class="license-key"><?php echo $license['license_key']; ?></span></td>
                                <td>
                                    <strong><?php echo htmlspecialchars($license['customer_name']); ?></strong><br>
                                    <small style="color: #666;"><?php echo htmlspecialchars($license['customer_email']); ?></small>
                                </td>
                                <td><?php echo ucfirst($license['license_type']); ?></td>
                                <td><?php echo $license['activation_count']; ?>/<?php echo $license['max_activations']; ?></td>
                                <td>
                                    <?php if ($license['expires_at']): ?>
                                        <?php echo date('d.m.Y', strtotime($license['expires_at'])); ?>
                                    <?php else: ?>
                                        <span style="color: #666;">Unbegrenzt</span>
                                    <?php endif; ?>
                                </td>
                                <td><span class="status-badge <?php echo $status_class; ?>"><?php echo $status_text; ?></span></td>
                                <td><?php echo date('d.m.Y H:i', strtotime($license['created_at'])); ?></td>
                                <td>
                                    <a href="license_details.php?key=<?php echo $license['license_key']; ?>" class="btn btn-primary">
                                        📊 Details
                                    </a>
                                    <?php if ($license['status'] === 'active'): ?>
                                        <button class="btn btn-danger" onclick="suspendLicense('<?php echo $license['license_key']; ?>')">
                                            🚫 Sperren
                                        </button>
                                    <?php else: ?>
                                        <button class="btn btn-success" onclick="activateLicense('<?php echo $license['license_key']; ?>')">
                                            ✅ Aktivieren
                                        </button>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Aktivierungs-Log -->
        <div class="section">
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
                <table>
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
                                <td><span class="license-key"><?php echo substr($activation['license_key'], 0, 10); ?>...</span></td>
                                <td><?php echo htmlspecialchars($activation['customer_name']); ?></td>
                                <td><span class="hardware-id"><?php echo substr($activation['hardware_id'], 0, 12); ?>...</span></td>
                                <td><?php echo date('d.m.Y H:i', strtotime($activation['first_activation'])); ?></td>
                                <td><?php echo date('d.m.Y H:i', strtotime($activation['last_validation'])); ?></td>
                                <td><?php echo $activation['app_version']; ?></td>
                                <td><?php echo $activation['validation_count']; ?></td>
                                <td><?php echo $activation['last_ip']; ?></td>
                                <td>
                                    <button class="btn btn-danger" onclick="deactivateHardware('<?php echo $activation['license_key']; ?>', '<?php echo $activation['hardware_id']; ?>')">
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

    <script>
        function toggleSection(id) {
            const section = document.getElementById(id);
            section.style.display = section.style.display === 'none' ? 'block' : 'none';
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
                            alert('Lizenz erfolgreich gesperrt');
                            location.reload();
                        } else {
                            alert('Fehler: ' + data.error);
                        }
                    })
                    .catch(error => alert('Fehler: ' + error));
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
                            alert('Lizenz erfolgreich aktiviert');
                            location.reload();
                        } else {
                            alert('Fehler: ' + data.error);
                        }
                    })
                    .catch(error => alert('Fehler: ' + error));
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
                            alert('Hardware-Aktivierung erfolgreich entfernt');
                            location.reload();
                        } else {
                            alert('Fehler: ' + data.error);
                        }
                    })
                    .catch(error => alert('Fehler: ' + error));
            }
        }

        // Auto-refresh alle 30 Sekunden
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</body>

</html>