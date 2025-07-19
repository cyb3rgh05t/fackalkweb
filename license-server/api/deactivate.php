<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once '../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$license_key = $input['license_key'] ?? '';
$hardware_id = $input['hardware_id'] ?? '';

if (empty($license_key) || empty($hardware_id)) {
    http_response_code(400);
    echo json_encode(['error' => 'License key and hardware ID required']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        UPDATE license_activations 
        SET status = 'deactivated', deactivated_at = NOW()
        WHERE license_key = ? AND hardware_id = ? AND status = 'active'
    ");
    $stmt->execute([$license_key, $hardware_id]);

    if ($stmt->rowCount() > 0) {
        logActivity('deactivation_success', [
            'license_key' => $license_key,
            'hardware_id' => $hardware_id
        ]);

        echo json_encode(['success' => true, 'message' => 'License deactivated successfully']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Active license not found']);
    }
} catch (PDOException $e) {
    error_log('License deactivation error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
