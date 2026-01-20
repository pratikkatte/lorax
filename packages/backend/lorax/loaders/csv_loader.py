from lorax.csv.config import CsvConfigOptions, build_csv_config


def get_config_csv(df, file_path, root_dir, window_size=50000):
    """Extract configuration from a Newick-per-row CSV file.

    Kept as a thin wrapper for backwards compatibility; real logic lives in
    `lorax.csv.config` for encapsulation and re-use.
    """
    return build_csv_config(df, str(file_path), options=CsvConfigOptions(window_size=window_size))
