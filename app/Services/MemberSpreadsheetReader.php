<?php

namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Http\UploadedFile;
use RuntimeException;
use ZipArchive;

class MemberSpreadsheetReader
{
    private const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const RELATIONSHIP_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    public function read(UploadedFile $file): array
    {
        return strtolower($file->getClientOriginalExtension()) === 'csv'
            ? $this->readCsv($file)
            : $this->readXlsx($file);
    }

    private function readCsv(UploadedFile $file): array
    {
        $stream = fopen($file->getRealPath(), 'rb');
        if ($stream === false) {
            throw new RuntimeException('File CSV tidak dapat dibaca.');
        }

        $rows = [];
        $rowNumber = 0;
        try {
            while (($cells = fgetcsv($stream, null, ',', '"', '\\')) !== false) {
                $rowNumber++;
                $rows[] = ['row' => $rowNumber, 'cells' => $cells];
            }
        } finally {
            fclose($stream);
        }

        return $rows;
    }

    private function readXlsx(UploadedFile $file): array
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('Server belum mendukung pembacaan file XLSX (ekstensi PHP ZIP tidak aktif).');
        }

        $archive = new ZipArchive;
        if ($archive->open($file->getRealPath()) !== true) {
            throw new RuntimeException('File XLSX tidak valid atau tidak dapat dibuka.');
        }

        try {
            $workbook = $this->loadXml($archive, 'xl/workbook.xml');
            $workbookXPath = new DOMXPath($workbook);
            $workbookXPath->registerNamespace('main', self::SPREADSHEET_NS);
            $workbookXPath->registerNamespace('rel', self::RELATIONSHIP_NS);
            $sheet = $workbookXPath->query('/main:workbook/main:sheets/main:sheet')->item(0);
            if (! $sheet instanceof DOMElement) {
                throw new RuntimeException('Workbook tidak memiliki worksheet.');
            }

            $relationshipId = $sheet->getAttributeNS(self::RELATIONSHIP_NS, 'id');
            $relationships = $this->loadXml($archive, 'xl/_rels/workbook.xml.rels');
            $relationshipXPath = new DOMXPath($relationships);
            $relationship = $relationshipXPath->query(
                '/*[local-name()="Relationships"]/*[local-name()="Relationship"][@Id="'.$relationshipId.'"]'
            )->item(0);
            if (! $relationship instanceof DOMElement) {
                throw new RuntimeException('Worksheet pertama pada workbook tidak ditemukan.');
            }

            $worksheetPath = $this->resolveWorksheetPath($relationship->getAttribute('Target'));
            $worksheet = $this->loadXml($archive, $worksheetPath);
            $worksheetXPath = new DOMXPath($worksheet);
            $worksheetXPath->registerNamespace('main', self::SPREADSHEET_NS);
            $sharedStrings = $this->readSharedStrings($archive);
            $rows = [];

            foreach ($worksheetXPath->query('/main:worksheet/main:sheetData/main:row') as $row) {
                if (! $row instanceof DOMElement) {
                    continue;
                }

                $cells = [];
                foreach ($worksheetXPath->query('./main:c', $row) as $cell) {
                    if (! $cell instanceof DOMElement) {
                        continue;
                    }

                    $column = $this->columnIndex($cell->getAttribute('r'));
                    $type = $cell->getAttribute('t');
                    if ($type === 'inlineStr') {
                        $value = $this->textContent($worksheetXPath->query('./main:is', $cell)->item(0));
                    } else {
                        $valueNode = $worksheetXPath->query('./main:v', $cell)->item(0);
                        $value = $valueNode?->textContent ?? '';
                        if ($type === 's' && $value !== '') {
                            $value = $sharedStrings[(int) $value] ?? '';
                        } elseif ($type === 'b') {
                            $value = $value === '1' ? 'TRUE' : 'FALSE';
                        }
                    }
                    $cells[$column] = $value;
                }

                if ($cells !== []) {
                    ksort($cells);
                    $rows[] = [
                        'row' => (int) ($row->getAttribute('r') ?: count($rows) + 1),
                        'cells' => $cells,
                    ];
                }
            }

            return $rows;
        } finally {
            $archive->close();
        }
    }

    private function loadXml(ZipArchive $archive, string $path): DOMDocument
    {
        $entry = $archive->statName($path);
        if ($entry === false || $entry['size'] > 10 * 1024 * 1024) {
            throw new RuntimeException('Workbook XLSX tidak lengkap atau ukuran worksheet terlalu besar.');
        }

        $contents = $archive->getFromName($path);
        if ($contents === false) {
            throw new RuntimeException('Workbook XLSX tidak lengkap atau rusak.');
        }

        $document = new DOMDocument;
        if (! $document->loadXML($contents, LIBXML_NONET | LIBXML_NOBLANKS)) {
            throw new RuntimeException('Struktur XML pada file XLSX tidak valid.');
        }

        return $document;
    }

    private function readSharedStrings(ZipArchive $archive): array
    {
        if ($archive->locateName('xl/sharedStrings.xml') === false) {
            return [];
        }

        $document = $this->loadXml($archive, 'xl/sharedStrings.xml');
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('main', self::SPREADSHEET_NS);
        $strings = [];
        foreach ($xpath->query('/main:sst/main:si') as $item) {
            $strings[] = $this->textContent($item);
        }

        return $strings;
    }

    private function resolveWorksheetPath(string $target): string
    {
        $path = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/'.$target;
        $parts = [];
        foreach (explode('/', str_replace('\\', '/', $path)) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }
            if ($part === '..') {
                if ($parts === []) {
                    throw new RuntimeException('Lokasi worksheet pada XLSX tidak valid.');
                }
                array_pop($parts);

                continue;
            }
            $parts[] = $part;
        }

        return implode('/', $parts);
    }

    private function columnIndex(string $cellReference): int
    {
        preg_match('/^[A-Z]+/i', $cellReference, $matches);
        if (! isset($matches[0])) {
            throw new RuntimeException('Referensi kolom pada XLSX tidak valid.');
        }

        $index = 0;
        foreach (str_split(strtoupper($matches[0])) as $letter) {
            $index = ($index * 26) + ord($letter) - ord('A') + 1;
        }

        return $index - 1;
    }

    private function textContent(?DOMElement $element): string
    {
        if (! $element) {
            return '';
        }

        $xpath = new DOMXPath($element->ownerDocument);
        $texts = $xpath->query('.//*[local-name()="t"]', $element);
        if ($texts->length === 0 && $element->localName === 't') {
            return $element->textContent;
        }

        $value = '';
        foreach ($texts as $text) {
            $value .= $text->textContent;
        }

        return $value;
    }
}
