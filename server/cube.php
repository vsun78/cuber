<?php

declare(strict_types=1);

const CUBE_FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const CUBE_SUFFIXES = ['', '2', "'"];

function scrambleCube(int $length = 20): array
{
    $moves = [];
    $previous = null;

    for ($index = 0; $index < $length; $index++) {
        $choices = array_values(array_diff(CUBE_FACES, [$previous]));
        $previous = $choices[random_int(0, count($choices) - 1)];
        $moves[] = $previous . CUBE_SUFFIXES[random_int(0, 2)];
    }

    return $moves;
}

function solveHistory(array $moves): array
{
    if (!array_is_list($moves) || count($moves) > 10000) {
        throw new InvalidArgumentException('Move history must be a list of up to 10,000 moves.');
    }

    $reduced = [];
    foreach ($moves as $move) {
        if (!is_string($move) || !preg_match("/^[URFDLB](?:2|')?$/D", $move)) {
            throw new InvalidArgumentException('Move history contains invalid cube notation.');
        }

        $face = $move[0];
        $amount = match (substr($move, 1)) {
            '2' => 2,
            "'" => 3,
            default => 1,
        };

        $last = end($reduced);
        if ($last !== false && $last[0] === $face) {
            array_pop($reduced);
            $amount = ($last[1] + $amount) % 4;
        }
        if ($amount !== 0) {
            $reduced[] = [$face, $amount];
        }
    }

    $inverseSuffixes = [1 => "'", 2 => '2', 3 => ''];
    return array_map(
        static fn (array $turn): string => $turn[0] . $inverseSuffixes[$turn[1]],
        array_reverse($reduced)
    );
}
