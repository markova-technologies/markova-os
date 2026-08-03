// Rust WebAssembly (WASM) Amharic Normalizer for Edge Workers

pub fn normalize_amharic_text(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    
    for ch in input.chars() {
        match ch {
            'ሐ' | 'ሑ' | 'ሒ' | 'ሓ' | 'ሔ' | 'ሕ' | 'ሖ' => normalized.push('ሀ'),
            'ሠ' | 'ሡ' | 'ሢ' | 'ሣ' | 'ሤ' | 'ሥ' | 'ሦ' => normalized.push('ሰ'),
            'ዐ' | 'ዑ' | 'ዒ' | 'ዓ' | 'ዔ' | 'ዕ' | 'ዖ' => normalized.push('አ'),
            _ => normalized.push(ch),
        }
    }
    
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalization() {
        assert_eq!(normalize_amharic_text("ሐበሻ"), "ሀበሻ");
    }
}
