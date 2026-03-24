# CSV Import Format

This document describes the format required for importing expense data into Orlando 2026.

## File Requirements

- **Format**: UTF-8 encoded CSV file
- **Extension**: `.csv`
- **Line endings**: Unix (LF) or Windows (CRLF) are both supported
- **Character encoding**: UTF-8 with BOM recommended for Excel compatibility

## Column Headers (Required)

Your CSV file MUST start with a header row containing these columns (in any order):

```
date,description,amount,currency,payer,category,participant,split_amount,notes
```

### Column Descriptions

| Column | Type | Required | Format/Constraints | Example |
|--------|------|----------|-------------------|---------|
| `date` | Date | Yes | `YYYY-MM-DD` | `2026-03-23` |
| `description` | Text | Yes | Any text (max 255 chars) | `Hotel booking for 3 nights` |
| `amount` | Number | Yes | Positive decimal with up to 2 decimals | `300.00` |
| `currency` | Text | Yes | 3-letter ISO 4217 code | `USD`, `BRL`, `EUR` |
| `payer` | Text | Yes | Participant name (exact match or creates new) | `John Doe` |
| `category` | Text | Yes | `Flight`, `Accommodation`, `Transport`, `Ticket`, or custom | `Accommodation` |
| `participant` | Text | Yes | Participant name (must exist or creates new) | `Maria Silva` |
| `split_amount` | Number | Yes | Positive decimal (must match or sum to `amount`) | `150.00` |
| `notes` | Text | No | Any text (max 500 chars) | `Shared with Sarah` |

## Example CSV

```csv
date,description,amount,currency,payer,category,participant,split_amount,notes
2026-03-23,Flight to Orlando,1500.00,USD,John Doe,Flight,John Doe,1500.00,Business class
2026-03-24,Hotel Orlando 3 nights,300.00,USD,Maria Silva,Accommodation,John Doe,150.00,Shared room
2026-03-24,Hotel Orlando 3 nights,300.00,USD,Maria Silva,Accommodation,Maria Silva,150.00,Shared room
2026-03-25,Rental car,120.00,USD,John Doe,Transport,John Doe,60.00,Gas included
2026-03-25,Rental car,120.00,USD,John Doe,Transport,Maria Silva,60.00,Gas included
2026-03-26,Dinner,85.50,USD,Maria Silva,Dining,John Doe,42.75,Restaurant downtown
2026-03-26,Dinner,85.50,USD,Maria Silva,Dining,Maria Silva,42.75,Restaurant downtown
```

## Import Rules

### Participant Creation

- If `payer` or `participant` doesn't exist in the group, it will be automatically created
- New participants are created with the provided name
- You can mix existing and new participant names in the same CSV

### Amount Validation

- Each expense amount must be positive (> 0)
- For multiple splits of the same expense, the `amount` field should be the same for all lines
- The `split_amount` should be the individual portion paid by each participant

### Date Validation

- Dates must be in `YYYY-MM-DD` format
- Invalid date formats will be rejected
- Future dates are allowed

### Currency Handling

- All amounts use the specified currency
- Each expense must have the same currency for all splits

## Common Issues and Solutions

### Error: "Invalid date format"
**Problem**: Date is not in `YYYY-MM-DD` format
**Solution**: Use dates like `2026-03-23`, not `3/23/2026` or `23-03-2026`

### Error: "Amount must be positive"
**Problem**: Amount is zero or negative
**Solution**: Ensure all amount values are greater than 0

### Error: "Currency code not valid"
**Problem**: Currency code is not a valid 3-letter code
**Solution**: Use valid ISO 4217 codes like `USD`, `EUR`, `BRL`, `GBP`, `JPY`

### Error: "Participant not found"
**Problem**: Participant name doesn't match existing participants
**Solution**: Either use exact names of existing participants, or the system will create new ones

## Import Process

1. Open the group dashboard
2. Scroll to "Data Management" section
3. Click "Import CSV" button
4. Select your CSV file from your computer
5. Review the import results:
   - **Success**: Shows count of imported expenses and new participants created
   - **Errors**: Shows a table with line numbers, error messages, and suggestions
6. If there are errors, fix them and try again

## Tips

- Test with a small CSV file first to ensure format is correct
- Use a spreadsheet application (Excel, Google Sheets) to prepare your data and export as CSV
- Ensure no extra blank rows or columns in your CSV
- Column order doesn't matter as long as headers are present
- Participant names should be consistent (use exact spelling and capitalization)

## Support

If you encounter issues importing your CSV:
1. Check the error message in the import results modal
2. Verify your file matches the format described above
3. Try importing a smaller subset first to isolate the problem
4. Ensure your CSV uses UTF-8 encoding
