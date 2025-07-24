<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔐 KFZ-App Lizenz-Verwaltung</title>
    <link rel="stylesheet" href="../assets/style.css">
    <style>
        /* Erweiterte Styles für das Admin-Dashboard */
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

        /* Dashboard-spezifische Anpassungen */
        .admin-header {
            background: linear-gradient(135deg, var(--clr-primary-a0) 0%, var(--clr-primary-a20) 100%);
            color: var(--clr-dark-a0);
            padding: 2rem;
            border-radius: 16px;
            margin-bottom: 2rem;
            text-align: center;
            box-shadow: var(--shadow-lg);
            position: relative;
            overflow: hidden;
        }

        .admin-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
            animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
            0% {
                transform: translateX(-100%);
            }

            100% {
                transform: translateX(100%);
            }
        }

        .admin-header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
            position: relative;
            z-index: 1;
        }

        .admin-header p {
            font-size: 1.1rem;
            opacity: 0.9;
            position: relative;
            z-index: 1;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .stat-card {
            background: linear-gradient(135deg, var(--clr-surface-a10) 0%, var(--clr-surface-a20) 100%);
            padding: 2rem;
            border-radius: 16px;
            text-align: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid var(--border-color);
            position: relative;
            overflow: hidden;
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(90deg, var(--clr-primary-a0), var(--clr-primary-a30));
        }

        .stat-card:hover {
            transform: translateY(-8px);
            box-shadow: var(--shadow-lg);
            border-color: var(--accent-primary);
        }

        .stat-number {
            font-size: 3rem;
            font-weight: 800;
            color: var(--accent-primary);
            margin-bottom: 0.5rem;
            line-height: 1;
        }

        .stat-label {
            color: var(--text-secondary);
            text-transform: uppercase;
            font-size: 0.875rem;
            letter-spacing: 1px;
            font-weight: 600;
        }

        .admin-section {
            background: var(--clr-surface-a10);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: var(--shadow);
            border: 1px solid var(--border-color);
            margin-bottom: 2rem;
            transition: all 0.3s ease;
        }

        .admin-section:hover {
            box-shadow: var(--shadow-lg);
        }

        .section-header {
            background: var(--clr-surface-a20);
            padding: 1.5rem 2rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        }

        .section-header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, var(--clr-primary-a0), transparent);
        }

        .section-header h2 {
            color: var(--text-primary);
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0;
        }

        .section-content {
            padding: 2rem;
        }

        .admin-form {
            background: var(--clr-surface-a20);
            padding: 2rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            margin-top: 1rem;
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: var(--text-primary);
            font-size: 0.95rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 0.875rem 1rem;
            background: var(--clr-surface-a30);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 0.95rem;
            transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(131, 222, 143, 0.18);
            background: var(--clr-surface-a20);
        }

        .admin-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--clr-surface-a20);
            border-radius: 12px;
            overflow: hidden;
        }

        .admin-table th,
        .admin-table td {
            padding: 1rem 1.5rem;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        .admin-table th {
            background: var(--clr-surface-a10);
            font-weight: 600;
            color: var(--text-primary);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .admin-table tbody tr {
            transition: all 0.2s ease;
        }

        .admin-table tbody tr:hover {
            background: var(--clr-surface-a10);
            transform: scale(1.01);
        }

        .license-key-display {
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            background: var(--clr-surface-tonal-a20);
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            font-size: 0.9rem;
            border: 1px solid var(--clr-surface-tonal-a30);
            color: var(--clr-primary-a30);
            font-weight: 500;
        }

        .hardware-id-display {
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            color: var(--text-muted);
            font-size: 0.85rem;
        }

        .status-badge {
            padding: 0.4rem 0.8rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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

        .customer-info {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .customer-name {
            font-weight: 600;
            color: var(--text-primary);
        }

        .customer-email {
            font-size: 0.875rem;
            color: var(--text-muted);
        }

        .activation-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
        }

        .activation-current {
            color: var(--accent-primary);
        }

        .activation-max {
            color: var(--text-muted);
        }

        .expiry-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .expiry-date {
            color: var(--text-primary);
            font-weight: 500;
        }

        .expiry-unlimited {
            color: var(--accent-success);
            font-style: italic;
        }

        .expiry-soon {
            color: var(--accent-warning);
        }

        .expiry-overdue {
            color: var(--accent-danger);
        }

        .actions-group {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .checkbox-group {
            display: flex;
            gap: 1.5rem;
            flex-wrap: wrap;
            margin-top: 0.5rem;
        }

        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .checkbox-item:hover {
            color: var(--accent-primary);
        }

        .checkbox-item input[type="checkbox"] {
            width: auto;
            margin: 0;
            accent-color: var(--accent-primary);
        }

        .features-section {
            background: var(--clr-surface-tonal-a20);
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid var(--clr-surface-tonal-a30);
        }

        .alert {
            padding: 1rem 1.5rem;
            margin: 1.5rem 0;
            border-radius: 8px;
            border: 1px solid;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .alert-success {
            background: rgba(131, 222, 143, 0.1);
            border-color: rgba(131, 222, 143, 0.3);
            color: var(--accent-success);
        }

        .alert-danger {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.3);
            color: var(--accent-danger);
        }

        .alert-info {
            background: rgba(131, 222, 143, 0.1);
            border-color: rgba(131, 222, 143, 0.3);
            color: var(--accent-primary);
        }

        .toggle-button {
            background: var(--clr-surface-a30);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
        }

        .toggle-button:hover {
            background: var(--accent-primary);
            color: var(--button-text-hover);
            border-color: var(--accent-primary);
            transform: translateY(-2px);
        }

        .collapsible-content {
            display: none;
            animation: fadeIn 0.3s ease-out;
        }

        .collapsible-content.active {
            display: block;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .admin-header h1 {
                font-size: 2rem;
            }

            .stats-grid {
                grid-template-columns: 1fr;
            }

            .form-grid {
                grid-template-columns: 1fr;
            }

            .section-header {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }

            .actions-group {
                justify-content: center;
            }

            .admin-table {
                font-size: 0.875rem;
            }

            .admin-table th,
            .admin-table td {
                padding: 0.75rem 0.5rem;
            }
        }

        @media (max-width: 480px) {
            .section-content {
                padding: 1rem;
            }

            .admin-form {
                padding: 1rem;
            }

            .checkbox-group {
                flex-direction: column;
                gap: 0.75rem;
            }
        }

        /* Dark Mode Print Styles */
        @media print {

            .admin-header,
            .toggle-button,
            .btn,
            .actions-group {
                display: none !important;
            }

            body {
                background: white !important;
                color: black !important;
            }

            .admin-section,
            .admin-table,
            .stat-card {
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
        <div class="admin-header">
            <h1>🔐 KFZ-App Lizenz-Verwaltung</h1>
            <p>Zentrale Verwaltung aller App-Lizenzen im neuen Dark Mode Design</p>
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
            // Hier könnte eine AJAX-Implementierung für das Filtern stehen
            console.log('Filter:', filter);
            // Für jetzt einfach neu laden
            location.reload();
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

            // Auto-Remove nach 5 Sekunden
            setTimeout(() => {
                notification.classList.add('hide');
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        }

        // Auto-refresh alle 30 Sekunden
        setInterval(() => {
            // Nur refreshen wenn keine Modals oder Forms offen sind
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