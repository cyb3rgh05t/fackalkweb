<?php
session_start();

// Admin-Zugangsdaten
$admin_users = [
    'cyb3rgh05t' => '$2y$10$Ca52bu0KMxxCjVqMzWRokOS83Tg5IRvQwPg5EVjAcFnas9Dp9izJi'
];

function isLoggedIn() {
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: login.php?redirect=' . urlencode($_SERVER['REQUEST_URI']));
        exit;
    }
}

function login($username, $password) {
    global $admin_users;
    
    if (isset($admin_users[$username]) && password_verify($password, $admin_users[$username])) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $username;
        $_SESSION['admin_login_time'] = time();
        
        // Log successful login
        if (function_exists('logActivity')) {
            logActivity('admin_login', [
                'username' => $username,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]);
        }
        
        return true;
    }
    
    return false;
}

function logout() {
    if (function_exists('logActivity') && isset($_SESSION['admin_username'])) {
        logActivity('admin_logout', [
            'username' => $_SESSION['admin_username'],
            'session_duration' => time() - ($_SESSION['admin_login_time'] ?? time())
        ]);
    }
    
    session_destroy();
    header('Location: login.php?logged_out=1');
    exit;
}

function getAdminUsername() {
    return $_SESSION['admin_username'] ?? 'Unbekannt';
}

function getSessionDuration() {
    $login_time = $_SESSION['admin_login_time'] ?? time();
    $duration = time() - $login_time;
    
    if ($duration < 60) return $duration . 's';
    if ($duration < 3600) return floor($duration / 60) . 'min';
    return floor($duration / 3600) . 'h ' . floor(($duration % 3600) / 60) . 'min';
}

// Session-Timeout (8 Stunden)
if (isLoggedIn() && isset($_SESSION['admin_login_time'])) {
    if (time() - $_SESSION['admin_login_time'] > 28800) {
        logout();
    }
}
?>