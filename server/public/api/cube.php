<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/cube.php';

function sendJson(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_THROW_ON_ERROR);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    sendJson(405, ['error' => 'Use POST for cube requests.']);
}

$body = file_get_contents('php://input', false, null, 0, 65537);
if ($body === false || strlen($body) > 65536) {
    sendJson(413, ['error' => 'The request is too large.']);
}

try {
    $request = json_decode($body, false, 16, JSON_THROW_ON_ERROR);
    if (!is_object($request)) {
        sendJson(400, ['error' => 'Send a JSON object.']);
    }

    switch ($request->action ?? null) {
        case 'scramble':
            sendJson(200, ['moves' => scrambleCube()]);
        case 'solve':
            if (!is_array($request->moves ?? null)) {
                sendJson(400, ['error' => 'Move history must be a list.']);
            }
            sendJson(200, ['moves' => solveHistory($request->moves)]);
        default:
            sendJson(400, ['error' => 'Choose scramble or solve.']);
    }
} catch (JsonException) {
    sendJson(400, ['error' => 'Send valid JSON.']);
} catch (InvalidArgumentException $error) {
    sendJson(400, ['error' => $error->getMessage()]);
}
