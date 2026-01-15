from lorax.utils import extract_sample_names, max_branch_length_from_newick

def get_config_csv(df, file_path, root_dir, window_size=50000):
    """Extract configuration from a CSV file with newick trees."""
    genome_length = int(df['genomic_positions'].max())
    intervals = []
    max_branch_length_all = 0
    samples_set = set()

    for _, row in df.iterrows():
        current_pos = int(row['genomic_positions'])
        max_br = max_branch_length_from_newick(row['newick'])
        sample_names = extract_sample_names(row['newick'])
        samples_set.update(sample_names)

        if max_br > max_branch_length_all:
            max_branch_length_all = max_br
        next_row = row.name + 1  # rely on DataFrame index (assumes default integer)
        if next_row < len(df):
            next_pos = int(df.iloc[next_row]['genomic_positions'])
        else:
            next_pos = current_pos + window_size
        intervals.append(current_pos)


    populations = {}
    nodes_population = []
    times = [0, max_branch_length_all]
    sample_names = {}
    for s in samples_set:
        sample_names[str(s)] = {"sample_name": s}
    config = {
        'genome_length': genome_length,
        'times': {'type': 'branch length', 'values': times},
        'intervals': intervals,
        'filename': str(file_path).split('/')[-1],
        'populations': populations,
        'nodes_population': nodes_population,
        'sample_names': sample_names,
    }
    return config
