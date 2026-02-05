---
source: https://tskit.dev/tskit/docs/stable/python-api.html
title: Python API — Tskit manual
---

- [Repository](https://github.com/tskit-dev/tskit "Source repository")
- [Suggest edit](https://github.com/tskit-dev/tskit/edit/main/docs/python-api.md "Suggest edit")
- [Open issue](https://github.com/tskit-dev/tskit/issues/new?title=Issue%20on%20page%20%2Fpython-api.html&body=Your%20issue%20content%20here. "Open an issue")

- [.md](_sources/python-api.md "Download source file")
- .pdf

# Python API

## Contents

- [Trees and tree sequences](#trees-and-tree-sequences)
  - [`TreeSequence` API](#treesequence-api)
    - [General properties](#general-properties)
    - [Efficient table column access](#efficient-table-column-access)
    - [Loading and saving](#loading-and-saving)
    - [Obtaining trees](#obtaining-trees)
    - [Obtaining other objects](#obtaining-other-objects)
      - [Tree topology](#tree-topology)
      - [Genetic variation](#genetic-variation)
      - [Demography](#demography)
      - [Other](#other)
    - [Tree sequence modification](#tree-sequence-modification)
    - [Identity by descent](#sec-python-api-tree-sequences-ibd)
    - [Tables](#tables)
    - [Statistics](#statistics)
    - [Topological analysis](#topological-analysis)
    - [Display](#display)
    - [Export](#export)
  - [`Tree` API](#tree-api)
    - [General properties](#sec-python-api-trees-general-properties)
    - [Creating new trees](#creating-new-trees)
    - [Node measures](#node-measures)
      - [Simple measures](#simple-measures)
      - [Array access](#array-access)
    - [Tree traversal](#tree-traversal)
    - [Topological analysis](#sec-python-api-trees-topological-analysis)
    - [Comparing trees](#comparing-trees)
    - [Balance/imbalance indices](#balance-imbalance-indices)
    - [Sites and mutations](#sites-and-mutations)
    - [Moving to other trees](#moving-to-other-trees)
    - [Display](#id3)
    - [Export](#id4)
- [Tables and Table Collections](#tables-and-table-collections)
  - [`TableCollection` API](#tablecollection-api)
    - [General properties](#id5)
    - [Transformation](#transformation)
      - [Modification](#modification)
      - [Creating a valid tree sequence](#creating-a-valid-tree-sequence)
    - [Miscellaneous methods](#miscellaneous-methods)
    - [Export](#id6)
  - [Table APIs](#table-apis)
    - [Accessing table data](#accessing-table-data)
      - [Text columns](#text-columns)
      - [Binary columns](#binary-columns)
    - [Table functions](#table-functions)
- [Metadata API](#metadata-api)
- [Provenance](#provenance)
- [Utility functions](#utility-functions)
- [Reference documentation](#reference-documentation)
  - [Constants](#constants)
    - [`NULL`](#tskit.NULL)
    - [`MISSING_DATA`](#tskit.MISSING_DATA)
    - [`NODE_IS_SAMPLE`](#tskit.NODE_IS_SAMPLE)
    - [`FORWARD`](#tskit.FORWARD)
    - [`REVERSE`](#tskit.REVERSE)
    - [`ALLELES_01`](#tskit.ALLELES_01)
    - [`ALLELES_ACGT`](#tskit.ALLELES_ACGT)
    - [`UNKNOWN_TIME`](#tskit.UNKNOWN_TIME)
    - [`TIME_UNITS_UNKNOWN`](#tskit.TIME_UNITS_UNKNOWN)
    - [`TIME_UNITS_UNCALIBRATED`](#tskit.TIME_UNITS_UNCALIBRATED)
  - [Exceptions](#exceptions)
    - [`DuplicatePositionsError`](#tskit.DuplicatePositionsError)
    - [`MetadataEncodingError`](#tskit.MetadataEncodingError)
    - [`MetadataSchemaValidationError`](#tskit.MetadataSchemaValidationError)
    - [`MetadataValidationError`](#tskit.MetadataValidationError)
    - [`ProvenanceValidationError`](#tskit.ProvenanceValidationError)
  - [Top-level functions](#top-level-functions)
    - [`all_trees()`](#tskit.all_trees)
    - [`all_tree_shapes()`](#tskit.all_tree_shapes)
    - [`all_tree_labellings()`](#tskit.all_tree_labellings)
    - [`is_unknown_time()`](#tskit.is_unknown_time)
    - [`load()`](#tskit.load)
    - [`load_text()`](#tskit.load_text)
    - [`pack_bytes()`](#tskit.pack_bytes)
    - [`pack_strings()`](#tskit.pack_strings)
    - [`parse_edges()`](#tskit.parse_edges)
    - [`parse_individuals()`](#tskit.parse_individuals)
    - [`parse_mutations()`](#tskit.parse_mutations)
    - [`parse_nodes()`](#tskit.parse_nodes)
    - [`parse_populations()`](#tskit.parse_populations)
    - [`parse_migrations()`](#tskit.parse_migrations)
    - [`parse_sites()`](#tskit.parse_sites)
    - [`random_nucleotides()`](#tskit.random_nucleotides)
    - [`register_metadata_codec()`](#tskit.register_metadata_codec)
    - [`validate_provenance()`](#tskit.validate_provenance)
    - [`unpack_bytes()`](#tskit.unpack_bytes)
    - [`unpack_strings()`](#tskit.unpack_strings)
  - [Tree and tree sequence classes](#tree-and-tree-sequence-classes)
    - [The `Tree` class](#the-tree-class)
      - [`Tree`](#tskit.Tree)
        - [`Tree.copy()`](#tskit.Tree.copy)
        - [`Tree.tree_sequence`](#tskit.Tree.tree_sequence)
        - [`Tree.root_threshold`](#tskit.Tree.root_threshold)
        - [`Tree.first()`](#tskit.Tree.first)
        - [`Tree.last()`](#tskit.Tree.last)
        - [`Tree.next()`](#tskit.Tree.next)
        - [`Tree.prev()`](#tskit.Tree.prev)
        - [`Tree.clear()`](#tskit.Tree.clear)
        - [`Tree.seek_index()`](#tskit.Tree.seek_index)
        - [`Tree.seek()`](#tskit.Tree.seek)
        - [`Tree.rank()`](#tskit.Tree.rank)
        - [`Tree.unrank()`](#tskit.Tree.unrank)
        - [`Tree.count_topologies()`](#tskit.Tree.count_topologies)
        - [`Tree.branch_length()`](#tskit.Tree.branch_length)
        - [`Tree.total_branch_length`](#tskit.Tree.total_branch_length)
        - [`Tree.mrca()`](#tskit.Tree.mrca)
        - [`Tree.tmrca()`](#tskit.Tree.tmrca)
        - [`Tree.parent()`](#tskit.Tree.parent)
        - [`Tree.parent_array`](#tskit.Tree.parent_array)
        - [`Tree.ancestors()`](#tskit.Tree.ancestors)
        - [`Tree.left_child()`](#tskit.Tree.left_child)
        - [`Tree.left_child_array`](#tskit.Tree.left_child_array)
        - [`Tree.right_child()`](#tskit.Tree.right_child)
        - [`Tree.right_child_array`](#tskit.Tree.right_child_array)
        - [`Tree.left_sib()`](#tskit.Tree.left_sib)
        - [`Tree.left_sib_array`](#tskit.Tree.left_sib_array)
        - [`Tree.right_sib()`](#tskit.Tree.right_sib)
        - [`Tree.right_sib_array`](#tskit.Tree.right_sib_array)
        - [`Tree.siblings()`](#tskit.Tree.siblings)
        - [`Tree.num_children_array`](#tskit.Tree.num_children_array)
        - [`Tree.edge()`](#tskit.Tree.edge)
        - [`Tree.edge_array`](#tskit.Tree.edge_array)
        - [`Tree.virtual_root`](#tskit.Tree.virtual_root)
        - [`Tree.num_edges`](#tskit.Tree.num_edges)
        - [`Tree.left_root`](#tskit.Tree.left_root)
        - [`Tree.children()`](#tskit.Tree.children)
        - [`Tree.time()`](#tskit.Tree.time)
        - [`Tree.depth()`](#tskit.Tree.depth)
        - [`Tree.population()`](#tskit.Tree.population)
        - [`Tree.is_internal()`](#tskit.Tree.is_internal)
        - [`Tree.is_leaf()`](#tskit.Tree.is_leaf)
        - [`Tree.is_isolated()`](#tskit.Tree.is_isolated)
        - [`Tree.is_sample()`](#tskit.Tree.is_sample)
        - [`Tree.is_descendant()`](#tskit.Tree.is_descendant)
        - [`Tree.num_nodes`](#tskit.Tree.num_nodes)
        - [`Tree.num_roots`](#tskit.Tree.num_roots)
        - [`Tree.has_single_root`](#tskit.Tree.has_single_root)
        - [`Tree.has_multiple_roots`](#tskit.Tree.has_multiple_roots)
        - [`Tree.roots`](#tskit.Tree.roots)
        - [`Tree.root`](#tskit.Tree.root)
        - [`Tree.is_root()`](#tskit.Tree.is_root)
        - [`Tree.index`](#tskit.Tree.index)
        - [`Tree.interval`](#tskit.Tree.interval)
        - [`Tree.span`](#tskit.Tree.span)
        - [`Tree.mid`](#tskit.Tree.mid)
        - [`Tree.draw_text()`](#tskit.Tree.draw_text)
        - [`Tree.draw_svg()`](#tskit.Tree.draw_svg)
        - [`Tree.draw()`](#tskit.Tree.draw)
        - [`Tree.num_mutations`](#tskit.Tree.num_mutations)
        - [`Tree.num_sites`](#tskit.Tree.num_sites)
        - [`Tree.sites()`](#tskit.Tree.sites)
        - [`Tree.mutations()`](#tskit.Tree.mutations)
        - [`Tree.leaves()`](#tskit.Tree.leaves)
        - [`Tree.samples()`](#tskit.Tree.samples)
        - [`Tree.num_children()`](#tskit.Tree.num_children)
        - [`Tree.num_samples()`](#tskit.Tree.num_samples)
        - [`Tree.num_tracked_samples()`](#tskit.Tree.num_tracked_samples)
        - [`Tree.preorder()`](#tskit.Tree.preorder)
        - [`Tree.postorder()`](#tskit.Tree.postorder)
        - [`Tree.timeasc()`](#tskit.Tree.timeasc)
        - [`Tree.timedesc()`](#tskit.Tree.timedesc)
        - [`Tree.nodes()`](#tskit.Tree.nodes)
        - [`Tree.as_newick()`](#tskit.Tree.as_newick)
        - [`Tree.newick()`](#tskit.Tree.newick)
        - [`Tree.as_dict_of_dicts()`](#tskit.Tree.as_dict_of_dicts)
        - [`Tree.__str__()`](#tskit.Tree.__str__)
        - [`Tree._repr_html_()`](#tskit.Tree._repr_html_)
        - [`Tree.map_mutations()`](#tskit.Tree.map_mutations)
        - [`Tree.kc_distance()`](#tskit.Tree.kc_distance)
        - [`Tree.rf_distance()`](#tskit.Tree.rf_distance)
        - [`Tree.path_length()`](#tskit.Tree.path_length)
        - [`Tree.distance_between()`](#tskit.Tree.distance_between)
        - [`Tree.b1_index()`](#tskit.Tree.b1_index)
        - [`Tree.b2_index()`](#tskit.Tree.b2_index)
        - [`Tree.colless_index()`](#tskit.Tree.colless_index)
        - [`Tree.sackin_index()`](#tskit.Tree.sackin_index)
        - [`Tree.num_lineages()`](#tskit.Tree.num_lineages)
        - [`Tree.split_polytomies()`](#tskit.Tree.split_polytomies)
        - [`Tree.generate_star()`](#tskit.Tree.generate_star)
        - [`Tree.generate_balanced()`](#tskit.Tree.generate_balanced)
        - [`Tree.generate_comb()`](#tskit.Tree.generate_comb)
        - [`Tree.generate_random_binary()`](#tskit.Tree.generate_random_binary)
    - [The `TreeSequence` class](#the-treesequence-class)
      - [`TreeSequence`](#tskit.TreeSequence)
        - [`TreeSequence.equals()`](#tskit.TreeSequence.equals)
        - [`TreeSequence.aslist()`](#tskit.TreeSequence.aslist)
        - [`TreeSequence.dump()`](#tskit.TreeSequence.dump)
        - [`TreeSequence.reference_sequence`](#tskit.TreeSequence.reference_sequence)
        - [`TreeSequence.has_reference_sequence()`](#tskit.TreeSequence.has_reference_sequence)
        - [`TreeSequence.tables_dict`](#tskit.TreeSequence.tables_dict)
        - [`TreeSequence.tables`](#tskit.TreeSequence.tables)
        - [`TreeSequence.nbytes`](#tskit.TreeSequence.nbytes)
        - [`TreeSequence.dump_tables()`](#tskit.TreeSequence.dump_tables)
        - [`TreeSequence.link_ancestors()`](#tskit.TreeSequence.link_ancestors)
        - [`TreeSequence.dump_text()`](#tskit.TreeSequence.dump_text)
        - [`TreeSequence.__str__()`](#tskit.TreeSequence.__str__)
        - [`TreeSequence._repr_html_()`](#tskit.TreeSequence._repr_html_)
        - [`TreeSequence.num_samples`](#tskit.TreeSequence.num_samples)
        - [`TreeSequence.table_metadata_schemas`](#tskit.TreeSequence.table_metadata_schemas)
        - [`TreeSequence.discrete_genome`](#tskit.TreeSequence.discrete_genome)
        - [`TreeSequence.discrete_time`](#tskit.TreeSequence.discrete_time)
        - [`TreeSequence.min_time`](#tskit.TreeSequence.min_time)
        - [`TreeSequence.max_time`](#tskit.TreeSequence.max_time)
        - [`TreeSequence.sequence_length`](#tskit.TreeSequence.sequence_length)
        - [`TreeSequence.metadata`](#tskit.TreeSequence.metadata)
        - [`TreeSequence.metadata_schema`](#tskit.TreeSequence.metadata_schema)
        - [`TreeSequence.time_units`](#tskit.TreeSequence.time_units)
        - [`TreeSequence.num_edges`](#tskit.TreeSequence.num_edges)
        - [`TreeSequence.num_trees`](#tskit.TreeSequence.num_trees)
        - [`TreeSequence.num_sites`](#tskit.TreeSequence.num_sites)
        - [`TreeSequence.num_mutations`](#tskit.TreeSequence.num_mutations)
        - [`TreeSequence.num_individuals`](#tskit.TreeSequence.num_individuals)
        - [`TreeSequence.num_nodes`](#tskit.TreeSequence.num_nodes)
        - [`TreeSequence.num_provenances`](#tskit.TreeSequence.num_provenances)
        - [`TreeSequence.num_populations`](#tskit.TreeSequence.num_populations)
        - [`TreeSequence.num_migrations`](#tskit.TreeSequence.num_migrations)
        - [`TreeSequence.max_root_time`](#tskit.TreeSequence.max_root_time)
        - [`TreeSequence.migrations()`](#tskit.TreeSequence.migrations)
        - [`TreeSequence.individuals()`](#tskit.TreeSequence.individuals)
        - [`TreeSequence.nodes()`](#tskit.TreeSequence.nodes)
        - [`TreeSequence.edges()`](#tskit.TreeSequence.edges)
        - [`TreeSequence.edge_diffs()`](#tskit.TreeSequence.edge_diffs)
        - [`TreeSequence.sites()`](#tskit.TreeSequence.sites)
        - [`TreeSequence.mutations()`](#tskit.TreeSequence.mutations)
        - [`TreeSequence.populations()`](#tskit.TreeSequence.populations)
        - [`TreeSequence.provenances()`](#tskit.TreeSequence.provenances)
        - [`TreeSequence.breakpoints()`](#tskit.TreeSequence.breakpoints)
        - [`TreeSequence.at()`](#tskit.TreeSequence.at)
        - [`TreeSequence.at_index()`](#tskit.TreeSequence.at_index)
        - [`TreeSequence.first()`](#tskit.TreeSequence.first)
        - [`TreeSequence.last()`](#tskit.TreeSequence.last)
        - [`TreeSequence.trees()`](#tskit.TreeSequence.trees)
        - [`TreeSequence.coiterate()`](#tskit.TreeSequence.coiterate)
        - [`TreeSequence.haplotypes()`](#tskit.TreeSequence.haplotypes)
        - [`TreeSequence.variants()`](#tskit.TreeSequence.variants)
        - [`TreeSequence.genotype_matrix()`](#tskit.TreeSequence.genotype_matrix)
        - [`TreeSequence.alignments()`](#tskit.TreeSequence.alignments)
        - [`TreeSequence.individuals_population`](#tskit.TreeSequence.individuals_population)
        - [`TreeSequence.individuals_time`](#tskit.TreeSequence.individuals_time)
        - [`TreeSequence.individuals_location`](#tskit.TreeSequence.individuals_location)
        - [`TreeSequence.individuals_flags`](#tskit.TreeSequence.individuals_flags)
        - [`TreeSequence.individuals_metadata`](#tskit.TreeSequence.individuals_metadata)
        - [`TreeSequence.individuals_nodes`](#tskit.TreeSequence.individuals_nodes)
        - [`TreeSequence.nodes_metadata`](#tskit.TreeSequence.nodes_metadata)
        - [`TreeSequence.nodes_time`](#tskit.TreeSequence.nodes_time)
        - [`TreeSequence.nodes_flags`](#tskit.TreeSequence.nodes_flags)
        - [`TreeSequence.nodes_population`](#tskit.TreeSequence.nodes_population)
        - [`TreeSequence.nodes_individual`](#tskit.TreeSequence.nodes_individual)
        - [`TreeSequence.edges_left`](#tskit.TreeSequence.edges_left)
        - [`TreeSequence.edges_right`](#tskit.TreeSequence.edges_right)
        - [`TreeSequence.edges_parent`](#tskit.TreeSequence.edges_parent)
        - [`TreeSequence.edges_child`](#tskit.TreeSequence.edges_child)
        - [`TreeSequence.edges_metadata`](#tskit.TreeSequence.edges_metadata)
        - [`TreeSequence.sites_position`](#tskit.TreeSequence.sites_position)
        - [`TreeSequence.sites_ancestral_state`](#tskit.TreeSequence.sites_ancestral_state)
        - [`TreeSequence.sites_metadata`](#tskit.TreeSequence.sites_metadata)
        - [`TreeSequence.mutations_site`](#tskit.TreeSequence.mutations_site)
        - [`TreeSequence.mutations_node`](#tskit.TreeSequence.mutations_node)
        - [`TreeSequence.mutations_parent`](#tskit.TreeSequence.mutations_parent)
        - [`TreeSequence.mutations_time`](#tskit.TreeSequence.mutations_time)
        - [`TreeSequence.mutations_derived_state`](#tskit.TreeSequence.mutations_derived_state)
        - [`TreeSequence.mutations_metadata`](#tskit.TreeSequence.mutations_metadata)
        - [`TreeSequence.mutations_edge`](#tskit.TreeSequence.mutations_edge)
        - [`TreeSequence.mutations_inherited_state`](#tskit.TreeSequence.mutations_inherited_state)
        - [`TreeSequence.migrations_left`](#tskit.TreeSequence.migrations_left)
        - [`TreeSequence.migrations_right`](#tskit.TreeSequence.migrations_right)
        - [`TreeSequence.migrations_node`](#tskit.TreeSequence.migrations_node)
        - [`TreeSequence.migrations_source`](#tskit.TreeSequence.migrations_source)
        - [`TreeSequence.migrations_dest`](#tskit.TreeSequence.migrations_dest)
        - [`TreeSequence.migrations_time`](#tskit.TreeSequence.migrations_time)
        - [`TreeSequence.migrations_metadata`](#tskit.TreeSequence.migrations_metadata)
        - [`TreeSequence.populations_metadata`](#tskit.TreeSequence.populations_metadata)
        - [`TreeSequence.indexes_edge_insertion_order`](#tskit.TreeSequence.indexes_edge_insertion_order)
        - [`TreeSequence.indexes_edge_removal_order`](#tskit.TreeSequence.indexes_edge_removal_order)
        - [`TreeSequence.individual()`](#tskit.TreeSequence.individual)
        - [`TreeSequence.node()`](#tskit.TreeSequence.node)
        - [`TreeSequence.edge()`](#tskit.TreeSequence.edge)
        - [`TreeSequence.migration()`](#tskit.TreeSequence.migration)
        - [`TreeSequence.mutation()`](#tskit.TreeSequence.mutation)
        - [`TreeSequence.site()`](#tskit.TreeSequence.site)
        - [`TreeSequence.population()`](#tskit.TreeSequence.population)
        - [`TreeSequence.provenance()`](#tskit.TreeSequence.provenance)
        - [`TreeSequence.samples()`](#tskit.TreeSequence.samples)
        - [`TreeSequence.as_vcf()`](#tskit.TreeSequence.as_vcf)
        - [`TreeSequence.write_vcf()`](#tskit.TreeSequence.write_vcf)
        - [`TreeSequence.write_fasta()`](#tskit.TreeSequence.write_fasta)
        - [`TreeSequence.as_fasta()`](#tskit.TreeSequence.as_fasta)
        - [`TreeSequence.write_nexus()`](#tskit.TreeSequence.write_nexus)
        - [`TreeSequence.as_nexus()`](#tskit.TreeSequence.as_nexus)
        - [`TreeSequence.to_macs()`](#tskit.TreeSequence.to_macs)
        - [`TreeSequence.simplify()`](#tskit.TreeSequence.simplify)
        - [`TreeSequence.delete_sites()`](#tskit.TreeSequence.delete_sites)
        - [`TreeSequence.delete_intervals()`](#tskit.TreeSequence.delete_intervals)
        - [`TreeSequence.keep_intervals()`](#tskit.TreeSequence.keep_intervals)
        - [`TreeSequence.ltrim()`](#tskit.TreeSequence.ltrim)
        - [`TreeSequence.rtrim()`](#tskit.TreeSequence.rtrim)
        - [`TreeSequence.trim()`](#tskit.TreeSequence.trim)
        - [`TreeSequence.shift()`](#tskit.TreeSequence.shift)
        - [`TreeSequence.concatenate()`](#tskit.TreeSequence.concatenate)
        - [`TreeSequence.split_edges()`](#tskit.TreeSequence.split_edges)
        - [`TreeSequence.decapitate()`](#tskit.TreeSequence.decapitate)
        - [`TreeSequence.extend_haplotypes()`](#tskit.TreeSequence.extend_haplotypes)
        - [`TreeSequence.subset()`](#tskit.TreeSequence.subset)
        - [`TreeSequence.union()`](#tskit.TreeSequence.union)
        - [`TreeSequence.draw_svg()`](#tskit.TreeSequence.draw_svg)
        - [`TreeSequence.draw_text()`](#tskit.TreeSequence.draw_text)
        - [`TreeSequence.general_stat()`](#tskit.TreeSequence.general_stat)
        - [`TreeSequence.sample_count_stat()`](#tskit.TreeSequence.sample_count_stat)
        - [`TreeSequence.diversity()`](#tskit.TreeSequence.diversity)
        - [`TreeSequence.divergence()`](#tskit.TreeSequence.divergence)
        - [`TreeSequence.divergence_matrix()`](#tskit.TreeSequence.divergence_matrix)
        - [`TreeSequence.genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness)
        - [`TreeSequence.genetic_relatedness_matrix()`](#tskit.TreeSequence.genetic_relatedness_matrix)
        - [`TreeSequence.genetic_relatedness_weighted()`](#tskit.TreeSequence.genetic_relatedness_weighted)
        - [`TreeSequence.genetic_relatedness_vector()`](#tskit.TreeSequence.genetic_relatedness_vector)
        - [`TreeSequence.pca()`](#tskit.TreeSequence.pca)
        - [`TreeSequence.trait_covariance()`](#tskit.TreeSequence.trait_covariance)
        - [`TreeSequence.trait_correlation()`](#tskit.TreeSequence.trait_correlation)
        - [`TreeSequence.trait_regression()`](#tskit.TreeSequence.trait_regression)
        - [`TreeSequence.trait_linear_model()`](#tskit.TreeSequence.trait_linear_model)
        - [`TreeSequence.segregating_sites()`](#tskit.TreeSequence.segregating_sites)
        - [`TreeSequence.allele_frequency_spectrum()`](#tskit.TreeSequence.allele_frequency_spectrum)
        - [`TreeSequence.Tajimas_D()`](#tskit.TreeSequence.Tajimas_D)
        - [`TreeSequence.Fst()`](#tskit.TreeSequence.Fst)
        - [`TreeSequence.Y3()`](#tskit.TreeSequence.Y3)
        - [`TreeSequence.Y2()`](#tskit.TreeSequence.Y2)
        - [`TreeSequence.Y1()`](#tskit.TreeSequence.Y1)
        - [`TreeSequence.f4()`](#tskit.TreeSequence.f4)
        - [`TreeSequence.f3()`](#tskit.TreeSequence.f3)
        - [`TreeSequence.f2()`](#tskit.TreeSequence.f2)
        - [`TreeSequence.mean_descendants()`](#tskit.TreeSequence.mean_descendants)
        - [`TreeSequence.genealogical_nearest_neighbours()`](#tskit.TreeSequence.genealogical_nearest_neighbours)
        - [`TreeSequence.kc_distance()`](#tskit.TreeSequence.kc_distance)
        - [`TreeSequence.count_topologies()`](#tskit.TreeSequence.count_topologies)
        - [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments)
        - [`TreeSequence.pair_coalescence_counts()`](#tskit.TreeSequence.pair_coalescence_counts)
        - [`TreeSequence.pair_coalescence_quantiles()`](#tskit.TreeSequence.pair_coalescence_quantiles)
        - [`TreeSequence.pair_coalescence_rates()`](#tskit.TreeSequence.pair_coalescence_rates)
        - [`TreeSequence.impute_unknown_mutations_time()`](#tskit.TreeSequence.impute_unknown_mutations_time)
        - [`TreeSequence.sample_nodes_by_ploidy()`](#tskit.TreeSequence.sample_nodes_by_ploidy)
        - [`TreeSequence.map_to_vcf_model()`](#tskit.TreeSequence.map_to_vcf_model)
        - [`TreeSequence.pairwise_diversity()`](#tskit.TreeSequence.pairwise_diversity)
  - [Simple container classes](#simple-container-classes)
    - [The `Individual` class](#the-individual-class)
      - [`Individual`](#tskit.Individual)
        - [`Individual.id`](#tskit.Individual.id)
        - [`Individual.flags`](#tskit.Individual.flags)
        - [`Individual.location`](#tskit.Individual.location)
        - [`Individual.parents`](#tskit.Individual.parents)
        - [`Individual.nodes`](#tskit.Individual.nodes)
        - [`Individual.metadata`](#tskit.Individual.metadata)
    - [The `Node` class](#the-node-class)
      - [`Node`](#tskit.Node)
        - [`Node.id`](#tskit.Node.id)
        - [`Node.flags`](#tskit.Node.flags)
        - [`Node.time`](#tskit.Node.time)
        - [`Node.population`](#tskit.Node.population)
        - [`Node.individual`](#tskit.Node.individual)
        - [`Node.metadata`](#tskit.Node.metadata)
        - [`Node.is_sample()`](#tskit.Node.is_sample)
    - [The `Edge` class](#the-edge-class)
      - [`Edge`](#tskit.Edge)
        - [`Edge.id`](#tskit.Edge.id)
        - [`Edge.left`](#tskit.Edge.left)
        - [`Edge.right`](#tskit.Edge.right)
        - [`Edge.parent`](#tskit.Edge.parent)
        - [`Edge.child`](#tskit.Edge.child)
        - [`Edge.metadata`](#tskit.Edge.metadata)
        - [`Edge.span`](#tskit.Edge.span)
        - [`Edge.interval`](#tskit.Edge.interval)
    - [The `Site` class](#the-site-class)
      - [`Site`](#tskit.Site)
        - [`Site.id`](#tskit.Site.id)
        - [`Site.position`](#tskit.Site.position)
        - [`Site.ancestral_state`](#tskit.Site.ancestral_state)
        - [`Site.mutations`](#tskit.Site.mutations)
        - [`Site.metadata`](#tskit.Site.metadata)
        - [`Site.alleles`](#tskit.Site.alleles)
    - [The `Mutation` class](#the-mutation-class)
      - [`Mutation`](#tskit.Mutation)
        - [`Mutation.id`](#tskit.Mutation.id)
        - [`Mutation.site`](#tskit.Mutation.site)
        - [`Mutation.node`](#tskit.Mutation.node)
        - [`Mutation.time`](#tskit.Mutation.time)
        - [`Mutation.derived_state`](#tskit.Mutation.derived_state)
        - [`Mutation.parent`](#tskit.Mutation.parent)
        - [`Mutation.metadata`](#tskit.Mutation.metadata)
        - [`Mutation.edge`](#tskit.Mutation.edge)
        - [`Mutation.inherited_state`](#tskit.Mutation.inherited_state)
    - [The `Variant` class](#the-variant-class)
      - [`Variant`](#tskit.Variant)
        - [`Variant.site`](#tskit.Variant.site)
        - [`Variant.alleles`](#tskit.Variant.alleles)
        - [`Variant.samples`](#tskit.Variant.samples)
        - [`Variant.genotypes`](#tskit.Variant.genotypes)
        - [`Variant.isolated_as_missing`](#tskit.Variant.isolated_as_missing)
        - [`Variant.has_missing_data`](#tskit.Variant.has_missing_data)
        - [`Variant.num_missing`](#tskit.Variant.num_missing)
        - [`Variant.num_alleles`](#tskit.Variant.num_alleles)
        - [`Variant.decode()`](#tskit.Variant.decode)
        - [`Variant.copy()`](#tskit.Variant.copy)
        - [`Variant.states()`](#tskit.Variant.states)
        - [`Variant.counts()`](#tskit.Variant.counts)
        - [`Variant.frequencies()`](#tskit.Variant.frequencies)
    - [The `Migration` class](#the-migration-class)
      - [`Migration`](#tskit.Migration)
        - [`Migration.left`](#tskit.Migration.left)
        - [`Migration.right`](#tskit.Migration.right)
        - [`Migration.node`](#tskit.Migration.node)
        - [`Migration.source`](#tskit.Migration.source)
        - [`Migration.dest`](#tskit.Migration.dest)
        - [`Migration.time`](#tskit.Migration.time)
        - [`Migration.metadata`](#tskit.Migration.metadata)
        - [`Migration.id`](#tskit.Migration.id)
    - [The `Population` class](#the-population-class)
      - [`Population`](#tskit.Population)
        - [`Population.id`](#tskit.Population.id)
        - [`Population.metadata`](#tskit.Population.metadata)
    - [The `Provenance` class](#the-provenance-class)
      - [`Provenance`](#tskit.Provenance)
        - [`Provenance.timestamp`](#tskit.Provenance.timestamp)
        - [`Provenance.record`](#tskit.Provenance.record)
    - [The `Interval` class](#the-interval-class)
      - [`Interval`](#tskit.Interval)
        - [`Interval.left`](#tskit.Interval.left)
        - [`Interval.right`](#tskit.Interval.right)
        - [`Interval.span`](#tskit.Interval.span)
        - [`Interval.mid`](#tskit.Interval.mid)
    - [The `Rank` class](#the-rank-class)
      - [`Rank`](#tskit.Rank)
        - [`Rank.shape`](#tskit.Rank.shape)
        - [`Rank.label`](#tskit.Rank.label)
  - [TableCollection and Table classes](#tablecollection-and-table-classes)
    - [The `TableCollection` class](#the-tablecollection-class)
      - [`TableCollection`](#tskit.TableCollection)
        - [`TableCollection.individuals`](#tskit.TableCollection.individuals)
        - [`TableCollection.nodes`](#tskit.TableCollection.nodes)
        - [`TableCollection.edges`](#tskit.TableCollection.edges)
        - [`TableCollection.migrations`](#tskit.TableCollection.migrations)
        - [`TableCollection.sites`](#tskit.TableCollection.sites)
        - [`TableCollection.mutations`](#tskit.TableCollection.mutations)
        - [`TableCollection.populations`](#tskit.TableCollection.populations)
        - [`TableCollection.provenances`](#tskit.TableCollection.provenances)
        - [`TableCollection.indexes`](#tskit.TableCollection.indexes)
        - [`TableCollection.sequence_length`](#tskit.TableCollection.sequence_length)
        - [`TableCollection.file_uuid`](#tskit.TableCollection.file_uuid)
        - [`TableCollection.time_units`](#tskit.TableCollection.time_units)
        - [`TableCollection.has_reference_sequence()`](#tskit.TableCollection.has_reference_sequence)
        - [`TableCollection.reference_sequence`](#tskit.TableCollection.reference_sequence)
        - [`TableCollection.asdict()`](#tskit.TableCollection.asdict)
        - [`TableCollection.table_name_map`](#tskit.TableCollection.table_name_map)
        - [`TableCollection.nbytes`](#tskit.TableCollection.nbytes)
        - [`TableCollection.equals()`](#tskit.TableCollection.equals)
        - [`TableCollection.assert_equals()`](#tskit.TableCollection.assert_equals)
        - [`TableCollection.dump()`](#tskit.TableCollection.dump)
        - [`TableCollection.copy()`](#tskit.TableCollection.copy)
        - [`TableCollection.tree_sequence()`](#tskit.TableCollection.tree_sequence)
        - [`TableCollection.simplify()`](#tskit.TableCollection.simplify)
        - [`TableCollection.link_ancestors()`](#tskit.TableCollection.link_ancestors)
        - [`TableCollection.sort()`](#tskit.TableCollection.sort)
        - [`TableCollection.sort_individuals()`](#tskit.TableCollection.sort_individuals)
        - [`TableCollection.canonicalise()`](#tskit.TableCollection.canonicalise)
        - [`TableCollection.compute_mutation_parents()`](#tskit.TableCollection.compute_mutation_parents)
        - [`TableCollection.compute_mutation_times()`](#tskit.TableCollection.compute_mutation_times)
        - [`TableCollection.deduplicate_sites()`](#tskit.TableCollection.deduplicate_sites)
        - [`TableCollection.delete_sites()`](#tskit.TableCollection.delete_sites)
        - [`TableCollection.delete_intervals()`](#tskit.TableCollection.delete_intervals)
        - [`TableCollection.keep_intervals()`](#tskit.TableCollection.keep_intervals)
        - [`TableCollection.ltrim()`](#tskit.TableCollection.ltrim)
        - [`TableCollection.rtrim()`](#tskit.TableCollection.rtrim)
        - [`TableCollection.trim()`](#tskit.TableCollection.trim)
        - [`TableCollection.shift()`](#tskit.TableCollection.shift)
        - [`TableCollection.delete_older()`](#tskit.TableCollection.delete_older)
        - [`TableCollection.clear()`](#tskit.TableCollection.clear)
        - [`TableCollection.has_index()`](#tskit.TableCollection.has_index)
        - [`TableCollection.build_index()`](#tskit.TableCollection.build_index)
        - [`TableCollection.drop_index()`](#tskit.TableCollection.drop_index)
        - [`TableCollection.subset()`](#tskit.TableCollection.subset)
        - [`TableCollection.union()`](#tskit.TableCollection.union)
        - [`TableCollection.ibd_segments()`](#tskit.TableCollection.ibd_segments)
        - [`TableCollection.metadata`](#tskit.TableCollection.metadata)
        - [`TableCollection.metadata_bytes`](#tskit.TableCollection.metadata_bytes)
        - [`TableCollection.metadata_schema`](#tskit.TableCollection.metadata_schema)
    - [`IndividualTable` classes](#individualtable-classes)
      - [`IndividualTable`](#tskit.IndividualTable)
        - [`IndividualTable.add_row()`](#tskit.IndividualTable.add_row)
        - [`IndividualTable.set_columns()`](#tskit.IndividualTable.set_columns)
        - [`IndividualTable.append_columns()`](#tskit.IndividualTable.append_columns)
        - [`IndividualTable.packset_location()`](#tskit.IndividualTable.packset_location)
        - [`IndividualTable.packset_parents()`](#tskit.IndividualTable.packset_parents)
        - [`IndividualTable.keep_rows()`](#tskit.IndividualTable.keep_rows)
        - [`IndividualTable.__getitem__()`](#tskit.IndividualTable.__getitem__)
        - [`IndividualTable.append()`](#tskit.IndividualTable.append)
        - [`IndividualTable.asdict()`](#tskit.IndividualTable.asdict)
        - [`IndividualTable.assert_equals()`](#tskit.IndividualTable.assert_equals)
        - [`IndividualTable.clear()`](#tskit.IndividualTable.clear)
        - [`IndividualTable.copy()`](#tskit.IndividualTable.copy)
        - [`IndividualTable.drop_metadata()`](#tskit.IndividualTable.drop_metadata)
        - [`IndividualTable.equals()`](#tskit.IndividualTable.equals)
        - [`IndividualTable.metadata_schema`](#tskit.IndividualTable.metadata_schema)
        - [`IndividualTable.metadata_vector()`](#tskit.IndividualTable.metadata_vector)
        - [`IndividualTable.nbytes`](#tskit.IndividualTable.nbytes)
        - [`IndividualTable.packset_metadata()`](#tskit.IndividualTable.packset_metadata)
        - [`IndividualTable.truncate()`](#tskit.IndividualTable.truncate)
      - [Associated row class](#associated-row-class)
        - [`IndividualTableRow`](#tskit.IndividualTableRow)
          - [`IndividualTableRow.flags`](#tskit.IndividualTableRow.flags)
          - [`IndividualTableRow.location`](#tskit.IndividualTableRow.location)
          - [`IndividualTableRow.parents`](#tskit.IndividualTableRow.parents)
          - [`IndividualTableRow.metadata`](#tskit.IndividualTableRow.metadata)
          - [`IndividualTableRow.asdict()`](#tskit.IndividualTableRow.asdict)
          - [`IndividualTableRow.replace()`](#tskit.IndividualTableRow.replace)
    - [`NodeTable` classes](#nodetable-classes)
      - [`NodeTable`](#tskit.NodeTable)
        - [`NodeTable.add_row()`](#tskit.NodeTable.add_row)
        - [`NodeTable.set_columns()`](#tskit.NodeTable.set_columns)
        - [`NodeTable.append_columns()`](#tskit.NodeTable.append_columns)
        - [`NodeTable.__getitem__()`](#tskit.NodeTable.__getitem__)
        - [`NodeTable.append()`](#tskit.NodeTable.append)
        - [`NodeTable.asdict()`](#tskit.NodeTable.asdict)
        - [`NodeTable.assert_equals()`](#tskit.NodeTable.assert_equals)
        - [`NodeTable.clear()`](#tskit.NodeTable.clear)
        - [`NodeTable.copy()`](#tskit.NodeTable.copy)
        - [`NodeTable.drop_metadata()`](#tskit.NodeTable.drop_metadata)
        - [`NodeTable.equals()`](#tskit.NodeTable.equals)
        - [`NodeTable.keep_rows()`](#tskit.NodeTable.keep_rows)
        - [`NodeTable.metadata_schema`](#tskit.NodeTable.metadata_schema)
        - [`NodeTable.metadata_vector()`](#tskit.NodeTable.metadata_vector)
        - [`NodeTable.nbytes`](#tskit.NodeTable.nbytes)
        - [`NodeTable.packset_metadata()`](#tskit.NodeTable.packset_metadata)
        - [`NodeTable.truncate()`](#tskit.NodeTable.truncate)
      - [Associated row class](#id10)
        - [`NodeTableRow`](#tskit.NodeTableRow)
          - [`NodeTableRow.flags`](#tskit.NodeTableRow.flags)
          - [`NodeTableRow.time`](#tskit.NodeTableRow.time)
          - [`NodeTableRow.population`](#tskit.NodeTableRow.population)
          - [`NodeTableRow.individual`](#tskit.NodeTableRow.individual)
          - [`NodeTableRow.metadata`](#tskit.NodeTableRow.metadata)
          - [`NodeTableRow.asdict()`](#tskit.NodeTableRow.asdict)
          - [`NodeTableRow.replace()`](#tskit.NodeTableRow.replace)
    - [`EdgeTable` classes](#edgetable-classes)
      - [`EdgeTable`](#tskit.EdgeTable)
        - [`EdgeTable.add_row()`](#tskit.EdgeTable.add_row)
        - [`EdgeTable.set_columns()`](#tskit.EdgeTable.set_columns)
        - [`EdgeTable.append_columns()`](#tskit.EdgeTable.append_columns)
        - [`EdgeTable.squash()`](#tskit.EdgeTable.squash)
        - [`EdgeTable.__getitem__()`](#tskit.EdgeTable.__getitem__)
        - [`EdgeTable.append()`](#tskit.EdgeTable.append)
        - [`EdgeTable.asdict()`](#tskit.EdgeTable.asdict)
        - [`EdgeTable.assert_equals()`](#tskit.EdgeTable.assert_equals)
        - [`EdgeTable.clear()`](#tskit.EdgeTable.clear)
        - [`EdgeTable.copy()`](#tskit.EdgeTable.copy)
        - [`EdgeTable.drop_metadata()`](#tskit.EdgeTable.drop_metadata)
        - [`EdgeTable.equals()`](#tskit.EdgeTable.equals)
        - [`EdgeTable.keep_rows()`](#tskit.EdgeTable.keep_rows)
        - [`EdgeTable.metadata_schema`](#tskit.EdgeTable.metadata_schema)
        - [`EdgeTable.metadata_vector()`](#tskit.EdgeTable.metadata_vector)
        - [`EdgeTable.nbytes`](#tskit.EdgeTable.nbytes)
        - [`EdgeTable.packset_metadata()`](#tskit.EdgeTable.packset_metadata)
        - [`EdgeTable.truncate()`](#tskit.EdgeTable.truncate)
      - [Associated row class](#id11)
        - [`EdgeTableRow`](#tskit.EdgeTableRow)
          - [`EdgeTableRow.left`](#tskit.EdgeTableRow.left)
          - [`EdgeTableRow.right`](#tskit.EdgeTableRow.right)
          - [`EdgeTableRow.parent`](#tskit.EdgeTableRow.parent)
          - [`EdgeTableRow.child`](#tskit.EdgeTableRow.child)
          - [`EdgeTableRow.metadata`](#tskit.EdgeTableRow.metadata)
          - [`EdgeTableRow.asdict()`](#tskit.EdgeTableRow.asdict)
          - [`EdgeTableRow.replace()`](#tskit.EdgeTableRow.replace)
    - [`MigrationTable` classes](#migrationtable-classes)
      - [`MigrationTable`](#tskit.MigrationTable)
        - [`MigrationTable.add_row()`](#tskit.MigrationTable.add_row)
        - [`MigrationTable.set_columns()`](#tskit.MigrationTable.set_columns)
        - [`MigrationTable.append_columns()`](#tskit.MigrationTable.append_columns)
        - [`MigrationTable.__getitem__()`](#tskit.MigrationTable.__getitem__)
        - [`MigrationTable.append()`](#tskit.MigrationTable.append)
        - [`MigrationTable.asdict()`](#tskit.MigrationTable.asdict)
        - [`MigrationTable.assert_equals()`](#tskit.MigrationTable.assert_equals)
        - [`MigrationTable.clear()`](#tskit.MigrationTable.clear)
        - [`MigrationTable.copy()`](#tskit.MigrationTable.copy)
        - [`MigrationTable.drop_metadata()`](#tskit.MigrationTable.drop_metadata)
        - [`MigrationTable.equals()`](#tskit.MigrationTable.equals)
        - [`MigrationTable.keep_rows()`](#tskit.MigrationTable.keep_rows)
        - [`MigrationTable.metadata_schema`](#tskit.MigrationTable.metadata_schema)
        - [`MigrationTable.metadata_vector()`](#tskit.MigrationTable.metadata_vector)
        - [`MigrationTable.nbytes`](#tskit.MigrationTable.nbytes)
        - [`MigrationTable.packset_metadata()`](#tskit.MigrationTable.packset_metadata)
        - [`MigrationTable.truncate()`](#tskit.MigrationTable.truncate)
      - [Associated row class](#id12)
        - [`MigrationTableRow`](#tskit.MigrationTableRow)
          - [`MigrationTableRow.left`](#tskit.MigrationTableRow.left)
          - [`MigrationTableRow.right`](#tskit.MigrationTableRow.right)
          - [`MigrationTableRow.node`](#tskit.MigrationTableRow.node)
          - [`MigrationTableRow.source`](#tskit.MigrationTableRow.source)
          - [`MigrationTableRow.dest`](#tskit.MigrationTableRow.dest)
          - [`MigrationTableRow.time`](#tskit.MigrationTableRow.time)
          - [`MigrationTableRow.metadata`](#tskit.MigrationTableRow.metadata)
          - [`MigrationTableRow.asdict()`](#tskit.MigrationTableRow.asdict)
          - [`MigrationTableRow.replace()`](#tskit.MigrationTableRow.replace)
    - [`SiteTable` classes](#sitetable-classes)
      - [`SiteTable`](#tskit.SiteTable)
        - [`SiteTable.add_row()`](#tskit.SiteTable.add_row)
        - [`SiteTable.set_columns()`](#tskit.SiteTable.set_columns)
        - [`SiteTable.append_columns()`](#tskit.SiteTable.append_columns)
        - [`SiteTable.packset_ancestral_state()`](#tskit.SiteTable.packset_ancestral_state)
        - [`SiteTable.__getitem__()`](#tskit.SiteTable.__getitem__)
        - [`SiteTable.append()`](#tskit.SiteTable.append)
        - [`SiteTable.asdict()`](#tskit.SiteTable.asdict)
        - [`SiteTable.assert_equals()`](#tskit.SiteTable.assert_equals)
        - [`SiteTable.clear()`](#tskit.SiteTable.clear)
        - [`SiteTable.copy()`](#tskit.SiteTable.copy)
        - [`SiteTable.drop_metadata()`](#tskit.SiteTable.drop_metadata)
        - [`SiteTable.equals()`](#tskit.SiteTable.equals)
        - [`SiteTable.keep_rows()`](#tskit.SiteTable.keep_rows)
        - [`SiteTable.metadata_schema`](#tskit.SiteTable.metadata_schema)
        - [`SiteTable.metadata_vector()`](#tskit.SiteTable.metadata_vector)
        - [`SiteTable.nbytes`](#tskit.SiteTable.nbytes)
        - [`SiteTable.packset_metadata()`](#tskit.SiteTable.packset_metadata)
        - [`SiteTable.truncate()`](#tskit.SiteTable.truncate)
      - [Associated row class](#id13)
        - [`SiteTableRow`](#tskit.SiteTableRow)
          - [`SiteTableRow.position`](#tskit.SiteTableRow.position)
          - [`SiteTableRow.ancestral_state`](#tskit.SiteTableRow.ancestral_state)
          - [`SiteTableRow.metadata`](#tskit.SiteTableRow.metadata)
          - [`SiteTableRow.asdict()`](#tskit.SiteTableRow.asdict)
          - [`SiteTableRow.replace()`](#tskit.SiteTableRow.replace)
    - [`MutationTable` classes](#mutationtable-classes)
      - [`MutationTable`](#tskit.MutationTable)
        - [`MutationTable.add_row()`](#tskit.MutationTable.add_row)
        - [`MutationTable.set_columns()`](#tskit.MutationTable.set_columns)
        - [`MutationTable.append_columns()`](#tskit.MutationTable.append_columns)
        - [`MutationTable.packset_derived_state()`](#tskit.MutationTable.packset_derived_state)
        - [`MutationTable.keep_rows()`](#tskit.MutationTable.keep_rows)
        - [`MutationTable.__getitem__()`](#tskit.MutationTable.__getitem__)
        - [`MutationTable.append()`](#tskit.MutationTable.append)
        - [`MutationTable.asdict()`](#tskit.MutationTable.asdict)
        - [`MutationTable.assert_equals()`](#tskit.MutationTable.assert_equals)
        - [`MutationTable.clear()`](#tskit.MutationTable.clear)
        - [`MutationTable.copy()`](#tskit.MutationTable.copy)
        - [`MutationTable.drop_metadata()`](#tskit.MutationTable.drop_metadata)
        - [`MutationTable.equals()`](#tskit.MutationTable.equals)
        - [`MutationTable.metadata_schema`](#tskit.MutationTable.metadata_schema)
        - [`MutationTable.metadata_vector()`](#tskit.MutationTable.metadata_vector)
        - [`MutationTable.nbytes`](#tskit.MutationTable.nbytes)
        - [`MutationTable.packset_metadata()`](#tskit.MutationTable.packset_metadata)
        - [`MutationTable.truncate()`](#tskit.MutationTable.truncate)
      - [Associated row class](#id14)
        - [`MutationTableRow`](#tskit.MutationTableRow)
          - [`MutationTableRow.site`](#tskit.MutationTableRow.site)
          - [`MutationTableRow.node`](#tskit.MutationTableRow.node)
          - [`MutationTableRow.derived_state`](#tskit.MutationTableRow.derived_state)
          - [`MutationTableRow.parent`](#tskit.MutationTableRow.parent)
          - [`MutationTableRow.metadata`](#tskit.MutationTableRow.metadata)
          - [`MutationTableRow.time`](#tskit.MutationTableRow.time)
          - [`MutationTableRow.asdict()`](#tskit.MutationTableRow.asdict)
          - [`MutationTableRow.replace()`](#tskit.MutationTableRow.replace)
    - [`PopulationTable` classes](#populationtable-classes)
      - [`PopulationTable`](#tskit.PopulationTable)
        - [`PopulationTable.add_row()`](#tskit.PopulationTable.add_row)
        - [`PopulationTable.set_columns()`](#tskit.PopulationTable.set_columns)
        - [`PopulationTable.append_columns()`](#tskit.PopulationTable.append_columns)
        - [`PopulationTable.__getitem__()`](#tskit.PopulationTable.__getitem__)
        - [`PopulationTable.append()`](#tskit.PopulationTable.append)
        - [`PopulationTable.asdict()`](#tskit.PopulationTable.asdict)
        - [`PopulationTable.assert_equals()`](#tskit.PopulationTable.assert_equals)
        - [`PopulationTable.clear()`](#tskit.PopulationTable.clear)
        - [`PopulationTable.copy()`](#tskit.PopulationTable.copy)
        - [`PopulationTable.drop_metadata()`](#tskit.PopulationTable.drop_metadata)
        - [`PopulationTable.equals()`](#tskit.PopulationTable.equals)
        - [`PopulationTable.keep_rows()`](#tskit.PopulationTable.keep_rows)
        - [`PopulationTable.metadata_schema`](#tskit.PopulationTable.metadata_schema)
        - [`PopulationTable.metadata_vector()`](#tskit.PopulationTable.metadata_vector)
        - [`PopulationTable.nbytes`](#tskit.PopulationTable.nbytes)
        - [`PopulationTable.packset_metadata()`](#tskit.PopulationTable.packset_metadata)
        - [`PopulationTable.truncate()`](#tskit.PopulationTable.truncate)
      - [Associated row class](#id15)
        - [`PopulationTableRow`](#tskit.PopulationTableRow)
          - [`PopulationTableRow.metadata`](#tskit.PopulationTableRow.metadata)
          - [`PopulationTableRow.asdict()`](#tskit.PopulationTableRow.asdict)
          - [`PopulationTableRow.replace()`](#tskit.PopulationTableRow.replace)
    - [`ProvenanceTable` classes](#provenancetable-classes)
      - [`ProvenanceTable`](#tskit.ProvenanceTable)
        - [`ProvenanceTable.add_row()`](#tskit.ProvenanceTable.add_row)
        - [`ProvenanceTable.set_columns()`](#tskit.ProvenanceTable.set_columns)
        - [`ProvenanceTable.append_columns()`](#tskit.ProvenanceTable.append_columns)
        - [`ProvenanceTable.packset_record()`](#tskit.ProvenanceTable.packset_record)
        - [`ProvenanceTable.packset_timestamp()`](#tskit.ProvenanceTable.packset_timestamp)
        - [`ProvenanceTable.equals()`](#tskit.ProvenanceTable.equals)
        - [`ProvenanceTable.assert_equals()`](#tskit.ProvenanceTable.assert_equals)
        - [`ProvenanceTable.append()`](#tskit.ProvenanceTable.append)
        - [`ProvenanceTable.asdict()`](#tskit.ProvenanceTable.asdict)
        - [`ProvenanceTable.clear()`](#tskit.ProvenanceTable.clear)
        - [`ProvenanceTable.copy()`](#tskit.ProvenanceTable.copy)
        - [`ProvenanceTable.keep_rows()`](#tskit.ProvenanceTable.keep_rows)
        - [`ProvenanceTable.nbytes`](#tskit.ProvenanceTable.nbytes)
        - [`ProvenanceTable.truncate()`](#tskit.ProvenanceTable.truncate)
      - [Associated row class](#id16)
        - [`ProvenanceTableRow`](#tskit.ProvenanceTableRow)
          - [`ProvenanceTableRow.timestamp`](#tskit.ProvenanceTableRow.timestamp)
          - [`ProvenanceTableRow.record`](#tskit.ProvenanceTableRow.record)
          - [`ProvenanceTableRow.asdict()`](#tskit.ProvenanceTableRow.asdict)
          - [`ProvenanceTableRow.replace()`](#tskit.ProvenanceTableRow.replace)
  - [Identity classes](#sec-python-api-reference-identity)
    - [The `IdentitySegments` class](#the-identitysegments-class)
      - [`IdentitySegments`](#tskit.IdentitySegments)
        - [`IdentitySegments.num_segments`](#tskit.IdentitySegments.num_segments)
        - [`IdentitySegments.num_pairs`](#tskit.IdentitySegments.num_pairs)
        - [`IdentitySegments.total_span`](#tskit.IdentitySegments.total_span)
        - [`IdentitySegments.pairs`](#tskit.IdentitySegments.pairs)
    - [The `IdentitySegmentList` class](#the-identitysegmentlist-class)
      - [`IdentitySegmentList`](#tskit.IdentitySegmentList)
        - [`IdentitySegmentList.total_span`](#tskit.IdentitySegmentList.total_span)
        - [`IdentitySegmentList.left`](#tskit.IdentitySegmentList.left)
        - [`IdentitySegmentList.right`](#tskit.IdentitySegmentList.right)
        - [`IdentitySegmentList.node`](#tskit.IdentitySegmentList.node)
    - [The `IdentitySegment` class](#the-identitysegment-class)
      - [`IdentitySegment`](#tskit.IdentitySegment)
        - [`IdentitySegment.left`](#tskit.IdentitySegment.left)
        - [`IdentitySegment.right`](#tskit.IdentitySegment.right)
        - [`IdentitySegment.node`](#tskit.IdentitySegment.node)
        - [`IdentitySegment.span`](#tskit.IdentitySegment.span)
  - [Miscellaneous classes](#miscellaneous-classes)
    - [The `ReferenceSequence` class](#the-referencesequence-class)
      - [`ReferenceSequence`](#tskit.ReferenceSequence)
        - [`ReferenceSequence.is_null()`](#tskit.ReferenceSequence.is_null)
        - [`ReferenceSequence.data`](#tskit.ReferenceSequence.data)
        - [`ReferenceSequence.metadata`](#tskit.ReferenceSequence.metadata)
        - [`ReferenceSequence.metadata_bytes`](#tskit.ReferenceSequence.metadata_bytes)
        - [`ReferenceSequence.metadata_schema`](#tskit.ReferenceSequence.metadata_schema)
    - [The `MetadataSchema` class](#the-metadataschema-class)
      - [`MetadataSchema`](#tskit.MetadataSchema)
        - [`MetadataSchema.asdict()`](#tskit.MetadataSchema.asdict)
        - [`MetadataSchema.validate_and_encode_row()`](#tskit.MetadataSchema.validate_and_encode_row)
        - [`MetadataSchema.decode_row()`](#tskit.MetadataSchema.decode_row)
        - [`MetadataSchema.encode_row()`](#tskit.MetadataSchema.encode_row)
        - [`MetadataSchema.structured_array_from_buffer()`](#tskit.MetadataSchema.structured_array_from_buffer)
        - [`MetadataSchema.permissive_json()`](#tskit.MetadataSchema.permissive_json)
        - [`MetadataSchema.null()`](#tskit.MetadataSchema.null)
    - [The `TableMetadataSchemas` class](#the-tablemetadataschemas-class)
      - [`TableMetadataSchemas`](#tskit.TableMetadataSchemas)
        - [`TableMetadataSchemas.node`](#tskit.TableMetadataSchemas.node)
        - [`TableMetadataSchemas.edge`](#tskit.TableMetadataSchemas.edge)
        - [`TableMetadataSchemas.site`](#tskit.TableMetadataSchemas.site)
        - [`TableMetadataSchemas.mutation`](#tskit.TableMetadataSchemas.mutation)
        - [`TableMetadataSchemas.migration`](#tskit.TableMetadataSchemas.migration)
        - [`TableMetadataSchemas.individual`](#tskit.TableMetadataSchemas.individual)
        - [`TableMetadataSchemas.population`](#tskit.TableMetadataSchemas.population)
    - [The `TopologyCounter` class](#the-topologycounter-class)
      - [`TopologyCounter`](#tskit.TopologyCounter)
    - [The `LdCalculator` class](#the-ldcalculator-class)
      - [`LdCalculator`](#tskit.LdCalculator)
        - [`LdCalculator.r2()`](#tskit.LdCalculator.r2)
        - [`LdCalculator.r2_array()`](#tskit.LdCalculator.r2_array)
        - [`LdCalculator.r2_matrix()`](#tskit.LdCalculator.r2_matrix)
    - [The `TableCollectionIndexes` class](#the-tablecollectionindexes-class)
      - [`TableCollectionIndexes`](#tskit.TableCollectionIndexes)
        - [`TableCollectionIndexes.asdict()`](#tskit.TableCollectionIndexes.asdict)
        - [`TableCollectionIndexes.nbytes`](#tskit.TableCollectionIndexes.nbytes)
    - [The `SVGString` class](#the-svgstring-class)
      - [`SVGString`](#tskit.SVGString)
        - [`SVGString._repr_svg_()`](#tskit.SVGString._repr_svg_)
    - [The `PCAResult` class](#the-pcaresult-class)
      - [`PCAResult`](#tskit.PCAResult)
        - [`PCAResult.factors`](#tskit.PCAResult.factors)
        - [`PCAResult.eigenvalues`](#tskit.PCAResult.eigenvalues)
        - [`PCAResult.range_sketch`](#tskit.PCAResult.range_sketch)
        - [`PCAResult.error_bound`](#tskit.PCAResult.error_bound)

# Python API[#](#python-api "Link to this heading")

This page documents the full tskit Python API. Brief thematic summaries of common
classes and methods are presented first. The [Reference documentation](#sec-python-api-reference) section
at the end then contains full details which aim to be concise, precise and exhaustive.
Note that this may not therefore be the best place to start if you are new
to a particular piece of functionality.

## Trees and tree sequences[#](#trees-and-tree-sequences "Link to this heading")

The [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") class represents a sequence of correlated
evolutionary trees along a genome. The [`Tree`](#tskit.Tree "tskit.Tree") class represents a
single tree in this sequence. These classes are the interfaces used to
interact with the trees and mutational information stored in a tree sequence,
for example as returned from a simulation or inferred from a set of DNA
sequences.

### [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") API[#](#treesequence-api "Link to this heading")

#### General properties[#](#general-properties "Link to this heading")

|  |  |
| --- | --- |
| [`TreeSequence.time_units`](#tskit.TreeSequence.time_units "tskit.TreeSequence.time_units") | String describing the units of the time dimension for this TreeSequence. |
| [`TreeSequence.nbytes`](#tskit.TreeSequence.nbytes "tskit.TreeSequence.nbytes") | Returns the total number of bytes required to store the data in this tree sequence. |
| [`TreeSequence.sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") | Returns the sequence length in this tree sequence. |
| [`TreeSequence.max_root_time`](#tskit.TreeSequence.max_root_time "tskit.TreeSequence.max_root_time") | Returns the time of the oldest root in any of the trees in this tree sequence. |
| [`TreeSequence.discrete_genome`](#tskit.TreeSequence.discrete_genome "tskit.TreeSequence.discrete_genome") | Returns True if all genome coordinates in this TreeSequence are discrete integer values. |
| [`TreeSequence.discrete_time`](#tskit.TreeSequence.discrete_time "tskit.TreeSequence.discrete_time") | Returns True if all time coordinates in this TreeSequence are discrete integer values. |
| [`TreeSequence.metadata`](#tskit.TreeSequence.metadata "tskit.TreeSequence.metadata") | The decoded metadata for this TreeSequence. |
| [`TreeSequence.metadata_schema`](#tskit.TreeSequence.metadata_schema "tskit.TreeSequence.metadata_schema") | The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this TreeSequence. |
| [`TreeSequence.reference_sequence`](#tskit.TreeSequence.reference_sequence "tskit.TreeSequence.reference_sequence") | The [`ReferenceSequence`](#tskit.ReferenceSequence "tskit.ReferenceSequence") associated with this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") if one is defined (see [`TreeSequence.has_reference_sequence()`](#tskit.TreeSequence.has_reference_sequence "tskit.TreeSequence.has_reference_sequence")), or None otherwise. |

#### Efficient table column access[#](#efficient-table-column-access "Link to this heading")

The [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") class provides access to underlying numerical
data defined in the [data model](data-model.html#sec-data-model) in two ways:

1. Via the [`TreeSequence.tables`](#tskit.TreeSequence.tables "tskit.TreeSequence.tables") property and the
   [Tables API](#sec-tables-api-accessing-table-data).
   Since version 1.0 this provides a direct, zero-copy, immutable view of the
   underlying memory.
2. Via a set of properties on the `TreeSequence` class that provide
   direct and efficient access to a single array in the underlying memory.

|  |  |
| --- | --- |
| [`TreeSequence.individuals_flags`](#tskit.TreeSequence.individuals_flags "tskit.TreeSequence.individuals_flags") | Efficient access to the bitwise `flags` column in the [Individual Table](data-model.html#sec-individual-table-definition) as a numpy array (dtype=np.uint32). |
| [`TreeSequence.nodes_time`](#tskit.TreeSequence.nodes_time "tskit.TreeSequence.nodes_time") | Efficient access to the `time` column in the [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.nodes_flags`](#tskit.TreeSequence.nodes_flags "tskit.TreeSequence.nodes_flags") | Efficient access to the bitwise `flags` column in the [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.uint32). |
| [`TreeSequence.nodes_population`](#tskit.TreeSequence.nodes_population "tskit.TreeSequence.nodes_population") | Efficient access to the `population` column in the [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.nodes_individual`](#tskit.TreeSequence.nodes_individual "tskit.TreeSequence.nodes_individual") | Efficient access to the `individual` column in the [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.edges_left`](#tskit.TreeSequence.edges_left "tskit.TreeSequence.edges_left") | Efficient access to the `left` column in the [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.edges_right`](#tskit.TreeSequence.edges_right "tskit.TreeSequence.edges_right") | Efficient access to the `right` column in the [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.edges_parent`](#tskit.TreeSequence.edges_parent "tskit.TreeSequence.edges_parent") | Efficient access to the `parent` column in the [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.edges_child`](#tskit.TreeSequence.edges_child "tskit.TreeSequence.edges_child") | Efficient access to the `child` column in the [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.sites_position`](#tskit.TreeSequence.sites_position "tskit.TreeSequence.sites_position") | Efficient access to the `position` column in the [Site Table](data-model.html#sec-site-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.sites_ancestral_state`](#tskit.TreeSequence.sites_ancestral_state "tskit.TreeSequence.sites_ancestral_state") | The `ancestral_state` column in the [Site Table](data-model.html#sec-site-table-definition) as a numpy array (dtype=StringDtype). |
| [`TreeSequence.mutations_site`](#tskit.TreeSequence.mutations_site "tskit.TreeSequence.mutations_site") | Efficient access to the `site` column in the [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.mutations_node`](#tskit.TreeSequence.mutations_node "tskit.TreeSequence.mutations_node") | Efficient access to the `node` column in the [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.mutations_parent`](#tskit.TreeSequence.mutations_parent "tskit.TreeSequence.mutations_parent") | Efficient access to the `parent` column in the [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.mutations_time`](#tskit.TreeSequence.mutations_time "tskit.TreeSequence.mutations_time") | Efficient access to the `time` column in the [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.mutations_derived_state`](#tskit.TreeSequence.mutations_derived_state "tskit.TreeSequence.mutations_derived_state") | Access to the `derived_state` column in the [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=StringDtype). |
| [`TreeSequence.mutations_metadata`](#tskit.TreeSequence.mutations_metadata "tskit.TreeSequence.mutations_metadata") | Efficient access to the `metadata` column in the [Mutation Table](data-model.html#sec-mutation-table-definition) as a structured numpy array. |
| [`TreeSequence.mutations_edge`](#tskit.TreeSequence.mutations_edge "tskit.TreeSequence.mutations_edge") | Return an array of the ID of the edge each mutation sits on in the tree sequence. |
| [`TreeSequence.mutations_inherited_state`](#tskit.TreeSequence.mutations_inherited_state "tskit.TreeSequence.mutations_inherited_state") | Return an array of the inherited state for each mutation in the tree sequence. |
| [`TreeSequence.migrations_left`](#tskit.TreeSequence.migrations_left "tskit.TreeSequence.migrations_left") | Efficient access to the `left` column in the [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.migrations_right`](#tskit.TreeSequence.migrations_right "tskit.TreeSequence.migrations_right") | Efficient access to the `right` column in the [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.migrations_right`](#tskit.TreeSequence.migrations_right "tskit.TreeSequence.migrations_right") | Efficient access to the `right` column in the [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.migrations_node`](#tskit.TreeSequence.migrations_node "tskit.TreeSequence.migrations_node") | Efficient access to the `node` column in the [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.migrations_source`](#tskit.TreeSequence.migrations_source "tskit.TreeSequence.migrations_source") | Efficient access to the `source` column in the [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.migrations_dest`](#tskit.TreeSequence.migrations_dest "tskit.TreeSequence.migrations_dest") | Efficient access to the `dest` column in the [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.int32). |
| [`TreeSequence.migrations_time`](#tskit.TreeSequence.migrations_time "tskit.TreeSequence.migrations_time") | Efficient access to the `time` column in the [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.float64). |
| [`TreeSequence.indexes_edge_insertion_order`](#tskit.TreeSequence.indexes_edge_insertion_order "tskit.TreeSequence.indexes_edge_insertion_order") | Efficient access to the `edge_insertion_order` column in the [Table indexes](data-model.html#sec-table-indexes) as a numpy array (dtype=np.int32). |
| [`TreeSequence.indexes_edge_removal_order`](#tskit.TreeSequence.indexes_edge_removal_order "tskit.TreeSequence.indexes_edge_removal_order") | Efficient access to the `edge_removal_order` column in the [Table indexes](data-model.html#sec-table-indexes) as a numpy array (dtype=np.int32). |

#### Loading and saving[#](#loading-and-saving "Link to this heading")

There are several methods for loading data into a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence")
instance. The simplest and most convenient is the use the [`tskit.load()`](#tskit.load "tskit.load")
function to load a [tree sequence file](file-formats.html#sec-tree-sequence-file-format). For small
scale data and debugging, it is often convenient to use the [`tskit.load_text()`](#tskit.load_text "tskit.load_text")
function to read data in the [text file format](file-formats.html#sec-text-file-format).
The [`TableCollection.tree_sequence()`](#tskit.TableCollection.tree_sequence "tskit.TableCollection.tree_sequence") function
efficiently creates a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") object from a
[`collection of tables`](#tskit.TableCollection "tskit.TableCollection")
using the [Tables API](#sec-tables-api).

Load a tree sequence
:   |  |  |
    | --- | --- |
    | [`load`](#tskit.load "tskit.load")(file, \*[, skip\_tables, ...]) | Return a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance loaded from the specified file object or path. |
    | [`load_text`](#tskit.load_text "tskit.load_text")(nodes, edges[, sites, mutations, ...]) | Return a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance parsed from tabulated text data contained in the specified file-like objects. |
    | [`TableCollection.tree_sequence`](#tskit.TableCollection.tree_sequence "tskit.TableCollection.tree_sequence")() | Returns a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance from the tables defined in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"), building the required indexes if they have not yet been created by [`build_index()`](#tskit.TableCollection.build_index "tskit.TableCollection.build_index"). |

Save a tree sequence
:   |  |  |
    | --- | --- |
    | [`TreeSequence.dump`](#tskit.TreeSequence.dump "tskit.TreeSequence.dump")(file\_or\_path[, ...]) | Writes the tree sequence to the specified path or file object. |

See also

Tree sequences with a single simple topology can also be created from scratch by
[generating](#sec-python-api-trees-creating) a [`Tree`](#tskit.Tree "tskit.Tree") and accessing its
[`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence") property.

#### Obtaining trees[#](#obtaining-trees "Link to this heading")

The following properties and methods return information about the
[`trees`](#tskit.Tree "tskit.Tree") that are generated along a tree sequence.

|  |  |
| --- | --- |
| [`TreeSequence.num_trees`](#tskit.TreeSequence.num_trees "tskit.TreeSequence.num_trees") | Returns the number of distinct trees in this tree sequence. |
| [`TreeSequence.trees`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees")([tracked\_samples, ...]) | Returns an iterator over the trees in this tree sequence. |
| [`TreeSequence.breakpoints`](#tskit.TreeSequence.breakpoints "tskit.TreeSequence.breakpoints")([as\_array]) | Returns the breakpoints that separate trees along the chromosome, including the two extreme points 0 and L. This is equivalent to::. |
| [`TreeSequence.coiterate`](#tskit.TreeSequence.coiterate "tskit.TreeSequence.coiterate")(other, \*\*kwargs) | Returns an iterator over the pairs of trees for each distinct interval in the specified pair of tree sequences. |
| [`TreeSequence.first`](#tskit.TreeSequence.first "tskit.TreeSequence.first")(\*\*kwargs) | Returns the first tree in this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence"). |
| [`TreeSequence.last`](#tskit.TreeSequence.last "tskit.TreeSequence.last")(\*\*kwargs) | Returns the last tree in this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence"). |
| [`TreeSequence.aslist`](#tskit.TreeSequence.aslist "tskit.TreeSequence.aslist")(\*\*kwargs) | Returns the trees in this tree sequence as a list. |
| [`TreeSequence.at`](#tskit.TreeSequence.at "tskit.TreeSequence.at")(position, \*\*kwargs) | Returns the tree covering the specified genomic location. |
| [`TreeSequence.at_index`](#tskit.TreeSequence.at_index "tskit.TreeSequence.at_index")(index, \*\*kwargs) | Returns the tree at the specified index. |

#### Obtaining other objects[#](#obtaining-other-objects "Link to this heading")

Various components make up a tree sequence, such as nodes and edges, sites and
mutations, and populations and individuals. These can be counted or converted into
Python objects using the following classes, properties, and methods.

##### Tree topology[#](#tree-topology "Link to this heading")

Nodes
:   |  |  |
    | --- | --- |
    | [`Node`](#tskit.Node "tskit.Node")(\*args[, metadata\_decoder]) | A [node](data-model.html#sec-node-table-definition) in a tree sequence, corresponding to a single genome. |
    | [`TreeSequence.num_nodes`](#tskit.TreeSequence.num_nodes "tskit.TreeSequence.num_nodes") | Returns the number of [nodes](data-model.html#sec-node-table-definition) in this tree sequence. |
    | [`TreeSequence.nodes`](#tskit.TreeSequence.nodes "tskit.TreeSequence.nodes")(\*[, order]) | Returns an iterable sequence of all the [nodes](data-model.html#sec-node-table-definition) in this tree sequence. |
    | [`TreeSequence.node`](#tskit.TreeSequence.node "tskit.TreeSequence.node")(id\_) | Returns the [node](data-model.html#sec-node-table-definition) in this tree sequence with the specified ID. |
    | [`TreeSequence.num_samples`](#tskit.TreeSequence.num_samples "tskit.TreeSequence.num_samples") | Returns the number of sample nodes in this tree sequence. |
    | [`TreeSequence.samples`](#tskit.TreeSequence.samples "tskit.TreeSequence.samples")([population, ...]) | Returns an array of the sample node IDs in this tree sequence. |

Edges
:   |  |  |
    | --- | --- |
    | [`Edge`](#tskit.Edge "tskit.Edge")(left, right, parent, child[, metadata, ...]) | An [edge](data-model.html#sec-edge-table-definition) in a tree sequence. |
    | [`TreeSequence.num_edges`](#tskit.TreeSequence.num_edges "tskit.TreeSequence.num_edges") | Returns the number of [edges](data-model.html#sec-edge-table-definition) in this tree sequence. |
    | [`TreeSequence.edges`](#tskit.TreeSequence.edges "tskit.TreeSequence.edges")() | Returns an iterable sequence of all the [edges](data-model.html#sec-edge-table-definition) in this tree sequence. |
    | [`TreeSequence.edge`](#tskit.TreeSequence.edge "tskit.TreeSequence.edge")(id\_) | Returns the [edge](data-model.html#sec-edge-table-definition) in this tree sequence with the specified ID. |

##### Genetic variation[#](#genetic-variation "Link to this heading")

Sites
:   |  |  |
    | --- | --- |
    | [`Site`](#tskit.Site "tskit.Site")(\*args[, metadata\_decoder]) | A [site](data-model.html#sec-site-table-definition) in a tree sequence. |
    | [`TreeSequence.num_sites`](#tskit.TreeSequence.num_sites "tskit.TreeSequence.num_sites") | Returns the number of [sites](data-model.html#sec-site-table-definition) in this tree sequence. |
    | [`TreeSequence.sites`](#tskit.TreeSequence.sites "tskit.TreeSequence.sites")() | Returns an iterable sequence of all the [sites](data-model.html#sec-site-table-definition) in this tree sequence. |
    | [`TreeSequence.site`](#tskit.TreeSequence.site "tskit.TreeSequence.site")([id\_, position]) | Returns the [site](data-model.html#sec-site-table-definition) in this tree sequence with either the specified ID or position. |
    | [`Variant`](#tskit.Variant "tskit.Variant")(tree\_sequence[, samples, ...]) | A variant in a tree sequence, describing the observed genetic variation among the specified nodes (by default, the sample nodes) for a given site. |
    | [`TreeSequence.variants`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants")(\*[, samples, ...]) | Returns an iterator over the variants between the `left` (inclusive) and `right` (exclusive) genomic positions in this tree sequence. |
    | [`TreeSequence.genotype_matrix`](#tskit.TreeSequence.genotype_matrix "tskit.TreeSequence.genotype_matrix")(\*[, samples, ...]) | Returns an \(m \times n\) numpy array of the genotypes in this tree sequence, where \(m\) is the number of sites and \(n\) is the number of requested nodes (default: the number of sample nodes). |
    | [`TreeSequence.haplotypes`](#tskit.TreeSequence.haplotypes "tskit.TreeSequence.haplotypes")(\*[, ...]) | Returns an iterator over the strings of haplotypes that result from the trees and mutations in this tree sequence. |
    | [`TreeSequence.alignments`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments")(\*[, ...]) | Returns an iterator over the full sequence alignments for the defined samples in this tree sequence. |

Mutations
:   |  |  |
    | --- | --- |
    | [`Mutation`](#tskit.Mutation "tskit.Mutation")(\*args[, metadata\_decoder]) | A [mutation](data-model.html#sec-mutation-table-definition) in a tree sequence. |
    | [`TreeSequence.num_mutations`](#tskit.TreeSequence.num_mutations "tskit.TreeSequence.num_mutations") | Returns the number of [mutations](data-model.html#sec-mutation-table-definition) in this tree sequence. |
    | [`TreeSequence.mutations`](#tskit.TreeSequence.mutations "tskit.TreeSequence.mutations")() | Returns an iterator over all the [mutations](data-model.html#sec-mutation-table-definition) in this tree sequence. |
    | [`TreeSequence.mutation`](#tskit.TreeSequence.mutation "tskit.TreeSequence.mutation")(id\_) | Returns the [mutation](data-model.html#sec-mutation-table-definition) in this tree sequence with the specified ID. |

##### Demography[#](#demography "Link to this heading")

Populations
:   |  |  |
    | --- | --- |
    | [`Population`](#tskit.Population "tskit.Population")(\*args[, metadata\_decoder]) | A [population](data-model.html#sec-population-table-definition) in a tree sequence. |
    | [`TreeSequence.num_populations`](#tskit.TreeSequence.num_populations "tskit.TreeSequence.num_populations") | Returns the number of [populations](data-model.html#sec-population-table-definition) in this tree sequence. |
    | [`TreeSequence.populations`](#tskit.TreeSequence.populations "tskit.TreeSequence.populations")() | Returns an iterable sequence of all the [populations](data-model.html#sec-population-table-definition) in this tree sequence. |
    | [`TreeSequence.population`](#tskit.TreeSequence.population "tskit.TreeSequence.population")(id\_) | Returns the [population](data-model.html#sec-population-table-definition) in this tree sequence with the specified ID. |

Migrations
:   |  |  |
    | --- | --- |
    | [`Migration`](#tskit.Migration "tskit.Migration")(\*args[, metadata\_decoder]) | A [migration](data-model.html#sec-migration-table-definition) in a tree sequence. |
    | [`TreeSequence.num_migrations`](#tskit.TreeSequence.num_migrations "tskit.TreeSequence.num_migrations") | Returns the number of [migrations](data-model.html#sec-migration-table-definition) in this tree sequence. |
    | [`TreeSequence.migrations`](#tskit.TreeSequence.migrations "tskit.TreeSequence.migrations")() | Returns an iterable sequence of all the [migrations](data-model.html#sec-migration-table-definition) in this tree sequence. |
    | [`TreeSequence.migration`](#tskit.TreeSequence.migration "tskit.TreeSequence.migration")(id\_) | Returns the [migration](data-model.html#sec-migration-table-definition) in this tree sequence with the specified ID. |

##### Other[#](#other "Link to this heading")

Individuals
:   |  |  |
    | --- | --- |
    | [`Individual`](#tskit.Individual "tskit.Individual")(\*args[, tree\_sequence]) | An [individual](data-model.html#sec-individual-table-definition) in a tree sequence. |
    | [`TreeSequence.num_individuals`](#tskit.TreeSequence.num_individuals "tskit.TreeSequence.num_individuals") | Returns the number of [individuals](data-model.html#sec-individual-table-definition) in this tree sequence. |
    | [`TreeSequence.individuals`](#tskit.TreeSequence.individuals "tskit.TreeSequence.individuals")() | Returns an iterable sequence of all the [individuals](data-model.html#sec-individual-table-definition) in this tree sequence. |
    | [`TreeSequence.individual`](#tskit.TreeSequence.individual "tskit.TreeSequence.individual")(id\_) | Returns the [individual](data-model.html#sec-individual-table-definition) in this tree sequence with the specified ID. |

Provenance entries (also see [Provenance](#sec-python-api-provenance))
:   |  |  |
    | --- | --- |
    | [`Provenance`](#tskit.Provenance "tskit.Provenance")(id, timestamp, record) | A provenance entry in a tree sequence, detailing how this tree sequence was generated, or subsequent operations on it (see [Provenance](provenance.html#sec-provenance)). |
    | [`TreeSequence.num_provenances`](#tskit.TreeSequence.num_provenances "tskit.TreeSequence.num_provenances") | Returns the number of [provenances](data-model.html#sec-provenance-table-definition) in this tree sequence. |
    | [`TreeSequence.provenances`](#tskit.TreeSequence.provenances "tskit.TreeSequence.provenances")() | Returns an iterable sequence of all the [provenances](data-model.html#sec-provenance-table-definition) in this tree sequence. |
    | [`TreeSequence.provenance`](#tskit.TreeSequence.provenance "tskit.TreeSequence.provenance")(id\_) | Returns the [provenance](data-model.html#sec-provenance-table-definition) in this tree sequence with the specified ID. |

#### Tree sequence modification[#](#tree-sequence-modification "Link to this heading")

Although tree sequences are immutable, several methods will taken an existing tree
sequence and return a modifed version. These are thin wrappers around the
[identically named methods of a TableCollection](#sec-tables-api-modification),
which perform the same actions but modify the [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") in place.

|  |  |
| --- | --- |
| [`TreeSequence.simplify`](#tskit.TreeSequence.simplify "tskit.TreeSequence.simplify")([samples, map\_nodes, ...]) | Returns a simplified tree sequence that retains only the history of the nodes given in the list `samples`. |
| [`TreeSequence.subset`](#tskit.TreeSequence.subset "tskit.TreeSequence.subset")(nodes[, ...]) | Returns a tree sequence containing only information directly referencing the provided list of nodes to retain. |
| [`TreeSequence.union`](#tskit.TreeSequence.union "tskit.TreeSequence.union")(other, node\_mapping[, ...]) | Returns an expanded tree sequence which contains the node-wise union of `self` and `other`, obtained by adding the non-shared portions of `other` onto `self`. |
| [`TreeSequence.concatenate`](#tskit.TreeSequence.concatenate "tskit.TreeSequence.concatenate")(\*args[, ...]) | Concatenate a set of tree sequences to the right of this one, by shifting their coordinate systems and adding all edges, sites, mutations, and any additional nodes, individuals, or populations needed for these. |
| [`TreeSequence.keep_intervals`](#tskit.TreeSequence.keep_intervals "tskit.TreeSequence.keep_intervals")(intervals[, ...]) | Returns a copy of this tree sequence which includes only information in the specified list of genomic intervals. |
| [`TreeSequence.delete_intervals`](#tskit.TreeSequence.delete_intervals "tskit.TreeSequence.delete_intervals")(intervals[, ...]) | Returns a copy of this tree sequence for which information in the specified list of genomic intervals has been deleted. |
| [`TreeSequence.delete_sites`](#tskit.TreeSequence.delete_sites "tskit.TreeSequence.delete_sites")(site\_ids[, ...]) | Returns a copy of this tree sequence with the specified sites (and their associated mutations) entirely removed. |
| [`TreeSequence.trim`](#tskit.TreeSequence.trim "tskit.TreeSequence.trim")([record\_provenance]) | Returns a copy of this tree sequence with any empty regions (i.e., those not covered by any edge) on the right and left trimmed away. |
| [`TreeSequence.shift`](#tskit.TreeSequence.shift "tskit.TreeSequence.shift")(value[, sequence\_length, ...]) | Shift the coordinate system (used by edges and sites) of this TableCollection by a given value. |
| [`TreeSequence.split_edges`](#tskit.TreeSequence.split_edges "tskit.TreeSequence.split_edges")(time, \*[, flags, ...]) | Returns a copy of this tree sequence in which we replace any edge `(left, right, parent, child)` in which `node_time[child] < time < node_time[parent]` with two edges `(left, right, parent, u)` and `(left, right, u, child)`, where `u` is a newly added node for each intersecting edge. |
| [`TreeSequence.decapitate`](#tskit.TreeSequence.decapitate "tskit.TreeSequence.decapitate")(time, \*[, flags, ...]) | Delete all edge topology and mutational information at least as old as the specified time from this tree sequence. |
| [`TreeSequence.extend_haplotypes`](#tskit.TreeSequence.extend_haplotypes "tskit.TreeSequence.extend_haplotypes")([max\_iter]) | Returns a new tree sequence in which the span covered by ancestral nodes is "extended" to regions of the genome according to the following rule: If an ancestral segment corresponding to node n has ancestor p and descendant c on some portion of the genome, and on an adjacent segment of genome p is still an ancestor of c, then n is inserted into the path from p to c. |

#### Identity by descent[#](#sec-python-api-tree-sequences-ibd "Link to this heading")

The [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method allows us to compute
identity relationships between pairs of samples. See the
[Identity by descent](ibd.html#sec-identity) section for more details and examples
and the [Identity classes](#sec-python-api-reference-identity) section for
API documentation on the associated classes.

|  |  |
| --- | --- |
| [`TreeSequence.ibd_segments`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments")(\*[, within, ...]) | Finds pairs of samples that are identical by descent (IBD) and returns the result as an [`IdentitySegments`](#tskit.IdentitySegments "tskit.IdentitySegments") instance. |

#### Tables[#](#tables "Link to this heading")

The underlying data in a tree sequence is stored in a
[collection of tables](#sec-tables-api). The following methods give access
to tables and associated functionality. Since tables can be modified, this
allows tree sequences to be edited: see the [Tables and editing](https://tskit.dev/tutorials/tables_and_editing.html#sec-tables "(in Project name not set)") tutorial for
an introduction.

|  |  |
| --- | --- |
| [`TreeSequence.tables`](#tskit.TreeSequence.tables "tskit.TreeSequence.tables") | Returns an immutable view of the tables underlying this tree sequence. |
| [`TreeSequence.dump_tables`](#tskit.TreeSequence.dump_tables "tskit.TreeSequence.dump_tables")() | Returns a modifiable copy of the [`tables`](#tskit.TableCollection "tskit.TableCollection") defining this tree sequence. |
| [`TreeSequence.table_metadata_schemas`](#tskit.TreeSequence.table_metadata_schemas "tskit.TreeSequence.table_metadata_schemas") | The set of metadata schemas for the tables in this tree sequence. |
| [`TreeSequence.tables_dict`](#tskit.TreeSequence.tables_dict "tskit.TreeSequence.tables_dict") | Returns a dictionary mapping names to tables in the underlying [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"). |

#### Statistics[#](#statistics "Link to this heading")

Single site
:   |  |  |
    | --- | --- |
    | [`TreeSequence.allele_frequency_spectrum`](#tskit.TreeSequence.allele_frequency_spectrum "tskit.TreeSequence.allele_frequency_spectrum")([...]) | Computes the allele frequency spectrum (AFS) in windows across the genome for with respect to the specified `sample_sets`. |
    | [`TreeSequence.divergence`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence")(sample\_sets[, ...]) | Computes mean genetic divergence between (and within) pairs of sets of nodes from `sample_sets`. |
    | [`TreeSequence.diversity`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity")([sample\_sets, ...]) | Computes mean genetic diversity (also known as "pi") in each of the sets of nodes from `sample_sets`. |
    | [`TreeSequence.f2`](#tskit.TreeSequence.f2 "tskit.TreeSequence.f2")(sample\_sets[, indexes, ...]) | Computes Patterson's f2 statistic between two groups of nodes from `sample_sets`. |
    | [`TreeSequence.f3`](#tskit.TreeSequence.f3 "tskit.TreeSequence.f3")(sample\_sets[, indexes, ...]) | Computes Patterson's f3 statistic between three groups of nodes from `sample_sets`. |
    | [`TreeSequence.f4`](#tskit.TreeSequence.f4 "tskit.TreeSequence.f4")(sample\_sets[, indexes, ...]) | Computes Patterson's f4 statistic between four groups of nodes from `sample_sets`. |
    | [`TreeSequence.Fst`](#tskit.TreeSequence.Fst "tskit.TreeSequence.Fst")(sample\_sets[, indexes, ...]) | Computes "windowed" Fst between pairs of sets of nodes from `sample_sets`. |
    | [`TreeSequence.genealogical_nearest_neighbours`](#tskit.TreeSequence.genealogical_nearest_neighbours "tskit.TreeSequence.genealogical_nearest_neighbours")(...) | Return the genealogical nearest neighbours (GNN) proportions for the given focal nodes, with reference to two or more sets of interest, averaged over all trees in the tree sequence. |
    | [`TreeSequence.genetic_relatedness`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness")(sample\_sets) | Computes genetic relatedness between (and within) pairs of sets of nodes from `sample_sets`. |
    | [`TreeSequence.genetic_relatedness_weighted`](#tskit.TreeSequence.genetic_relatedness_weighted "tskit.TreeSequence.genetic_relatedness_weighted")(W) | Computes weighted genetic relatedness. |
    | [`TreeSequence.genetic_relatedness_vector`](#tskit.TreeSequence.genetic_relatedness_vector "tskit.TreeSequence.genetic_relatedness_vector")(W[, ...]) | Computes the product of the genetic relatedness matrix and a vector of weights (one per sample). |
    | [`TreeSequence.genetic_relatedness_matrix`](#tskit.TreeSequence.genetic_relatedness_matrix "tskit.TreeSequence.genetic_relatedness_matrix")([...]) | Computes the full matrix of pairwise genetic relatedness values between (and within) pairs of sets of nodes from `sample_sets`. |
    | [`TreeSequence.general_stat`](#tskit.TreeSequence.general_stat "tskit.TreeSequence.general_stat")(W, f, output\_dim) | Compute a windowed statistic from weights and a summary function. |
    | [`TreeSequence.segregating_sites`](#tskit.TreeSequence.segregating_sites "tskit.TreeSequence.segregating_sites")([...]) | Computes the density of segregating sites for each of the sets of nodes from `sample_sets`, and related quantities. |
    | [`TreeSequence.sample_count_stat`](#tskit.TreeSequence.sample_count_stat "tskit.TreeSequence.sample_count_stat")(sample\_sets, ...) | Compute a windowed statistic from sample counts and a summary function. |
    | [`TreeSequence.mean_descendants`](#tskit.TreeSequence.mean_descendants "tskit.TreeSequence.mean_descendants")(sample\_sets) | Computes for every node the mean number of samples in each of the sample\_sets that descend from that node, averaged over the portions of the genome for which the node is ancestral to *any* sample. |
    | [`TreeSequence.Tajimas_D`](#tskit.TreeSequence.Tajimas_D "tskit.TreeSequence.Tajimas_D")([sample\_sets, ...]) | Computes Tajima's D of sets of nodes from `sample_sets` in windows. |
    | [`TreeSequence.trait_correlation`](#tskit.TreeSequence.trait_correlation "tskit.TreeSequence.trait_correlation")(W[, windows, ...]) | Computes the mean squared correlations between each of the columns of `W` (the "phenotypes") and inheritance along the tree sequence. |
    | [`TreeSequence.trait_covariance`](#tskit.TreeSequence.trait_covariance "tskit.TreeSequence.trait_covariance")(W[, windows, ...]) | Computes the mean squared covariances between each of the columns of `W` (the "phenotypes") and inheritance along the tree sequence. |
    | [`TreeSequence.trait_linear_model`](#tskit.TreeSequence.trait_linear_model "tskit.TreeSequence.trait_linear_model")(W[, Z, ...]) | Finds the relationship between trait and genotype after accounting for covariates. |
    | [`TreeSequence.Y2`](#tskit.TreeSequence.Y2 "tskit.TreeSequence.Y2")(sample\_sets[, indexes, ...]) | Computes the 'Y2' statistic between pairs of sets of nodes from `sample_sets`. |
    | [`TreeSequence.Y3`](#tskit.TreeSequence.Y3 "tskit.TreeSequence.Y3")(sample\_sets[, indexes, ...]) | Computes the 'Y' statistic between triples of sets of nodes from `sample_sets`. |

Comparative
:   |  |  |
    | --- | --- |
    | [`TreeSequence.kc_distance`](#tskit.TreeSequence.kc_distance "tskit.TreeSequence.kc_distance")(other[, lambda\_]) | Returns the average [`Tree.kc_distance()`](#tskit.Tree.kc_distance "tskit.Tree.kc_distance") between pairs of trees along the sequence whose intervals overlap. |

#### Topological analysis[#](#topological-analysis "Link to this heading")

The topology of a tree in a tree sequence refers to the relationship among
samples ignoring branch lengths. Functionality as described in
[Topological analysis](topological-analysis.html#sec-topological-analysis) is mainly provided via
[methods on trees](#sec-python-api-trees-topological-analysis), but more
efficient methods sometimes exist for entire tree sequences:

|  |  |
| --- | --- |
| [`TreeSequence.count_topologies`](#tskit.TreeSequence.count_topologies "tskit.TreeSequence.count_topologies")([sample\_sets]) | Returns a generator that produces the same distribution of topologies as [`Tree.count_topologies()`](#tskit.Tree.count_topologies "tskit.Tree.count_topologies") but sequentially for every tree in a tree sequence. |

#### Display[#](#display "Link to this heading")

|  |  |
| --- | --- |
| [`TreeSequence.draw_svg`](#tskit.TreeSequence.draw_svg "tskit.TreeSequence.draw_svg")([path, size, x\_scale, ...]) | Return an SVG representation of a tree sequence. |
| [`TreeSequence.draw_text`](#tskit.TreeSequence.draw_text "tskit.TreeSequence.draw_text")(\*[, node\_labels, ...]) | Create a text representation of a tree sequence. |
| [`TreeSequence.__str__`](#tskit.TreeSequence.__str__ "tskit.TreeSequence.__str__")() | Return a plain text summary of the contents of a tree sequence |
| [`TreeSequence._repr_html_`](#tskit.TreeSequence._repr_html_ "tskit.TreeSequence._repr_html_")() | Return an html summary of a tree sequence. |

#### Export[#](#export "Link to this heading")

|  |  |
| --- | --- |
| [`TreeSequence.as_fasta`](#tskit.TreeSequence.as_fasta "tskit.TreeSequence.as_fasta")(\*\*kwargs) | Return the result of [`write_fasta()`](#tskit.TreeSequence.write_fasta "tskit.TreeSequence.write_fasta") as a string. |
| [`TreeSequence.as_nexus`](#tskit.TreeSequence.as_nexus "tskit.TreeSequence.as_nexus")(\*\*kwargs) | Return the result of [`write_nexus()`](#tskit.TreeSequence.write_nexus "tskit.TreeSequence.write_nexus") as a string. |
| [`TreeSequence.dump_text`](#tskit.TreeSequence.dump_text "tskit.TreeSequence.dump_text")([nodes, edges, ...]) | Writes a text representation of the tables underlying the tree sequence to the specified connections. |
| [`TreeSequence.to_macs`](#tskit.TreeSequence.to_macs "tskit.TreeSequence.to_macs")() | Return a [macs encoding](https://github.com/gchen98/macs) of this tree sequence. |
| [`TreeSequence.write_fasta`](#tskit.TreeSequence.write_fasta "tskit.TreeSequence.write_fasta")(file\_or\_path, \*[, ...]) | Writes the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") for this tree sequence to file in [FASTA](https://en.wikipedia.org/wiki/FASTA_format) format. |
| [`TreeSequence.write_nexus`](#tskit.TreeSequence.write_nexus "tskit.TreeSequence.write_nexus")(file\_or\_path, \*[, ...]) | Returns a [nexus encoding](https://en.wikipedia.org/wiki/Nexus_file) of this tree sequence. |
| [`TreeSequence.write_vcf`](#tskit.TreeSequence.write_vcf "tskit.TreeSequence.write_vcf")(output[, ploidy, ...]) | Convert the genetic variation data in this tree sequence to Variant Call Format and write to the specified file-like object. |

### [`Tree`](#tskit.Tree "tskit.Tree") API[#](#tree-api "Link to this heading")

A tree is an instance of the [`Tree`](#tskit.Tree "tskit.Tree") class. These trees cannot exist
independently of the [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") from which they are generated.
Usually, therefore, a [`Tree`](#tskit.Tree "tskit.Tree") instance is created by
[Obtaining trees](#sec-python-api-tree-sequences-obtaining-trees) from an existing tree
sequence (although it is also possible to generate a new instance of a
[`Tree`](#tskit.Tree "tskit.Tree") belonging to the same tree sequence using [`Tree.copy()`](#tskit.Tree.copy "tskit.Tree.copy")).

Note

For efficiency, each instance of a [`Tree`](#tskit.Tree "tskit.Tree") is a state-machine
whose internal state corresponds to one of the trees in the parent tree sequence:
[Moving to other trees](#sec-python-api-trees-moving-to) in the tree sequence does not require a
new instance to be created, but simply the internal state to be changed.

#### General properties[#](#sec-python-api-trees-general-properties "Link to this heading")

|  |  |
| --- | --- |
| [`Tree.tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence") | Returns the tree sequence that this tree is from. |
| [`Tree.total_branch_length`](#tskit.Tree.total_branch_length "tskit.Tree.total_branch_length") | Returns the sum of all the branch lengths in this tree (in units of time). This is equivalent to::. |
| [`Tree.root_threshold`](#tskit.Tree.root_threshold "tskit.Tree.root_threshold") | Returns the minimum number of samples that a node must be an ancestor of to be considered a potential root. |
| [`Tree.virtual_root`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root") | The ID of the virtual root in this tree. |
| [`Tree.num_edges`](#tskit.Tree.num_edges "tskit.Tree.num_edges") | The total number of edges in this tree. |
| [`Tree.num_roots`](#tskit.Tree.num_roots "tskit.Tree.num_roots") | The number of roots in this tree, as defined in the [`roots`](#tskit.Tree.roots "tskit.Tree.roots") attribute. |
| [`Tree.has_single_root`](#tskit.Tree.has_single_root "tskit.Tree.has_single_root") | `True` if this tree has a single root, `False` otherwise. |
| [`Tree.has_multiple_roots`](#tskit.Tree.has_multiple_roots "tskit.Tree.has_multiple_roots") | `True` if this tree has more than one root, `False` otherwise. |
| [`Tree.root`](#tskit.Tree.root "tskit.Tree.root") | The root of this tree. |
| [`Tree.roots`](#tskit.Tree.roots "tskit.Tree.roots") | The list of roots in this tree. |
| [`Tree.index`](#tskit.Tree.index "tskit.Tree.index") | Returns the index this tree occupies in the parent tree sequence. |
| [`Tree.interval`](#tskit.Tree.interval "tskit.Tree.interval") | Returns the coordinates of the genomic interval that this tree represents the history of. |
| [`Tree.span`](#tskit.Tree.span "tskit.Tree.span") | Returns the genomic distance that this tree spans. |

#### Creating new trees[#](#creating-new-trees "Link to this heading")

It is sometimes useful to create an entirely new tree sequence consisting
of just a single tree (a “one-tree sequence”). The follow methods create such an
object and return a [`Tree`](#tskit.Tree "tskit.Tree") instance corresponding to that tree.
The new tree sequence to which the tree belongs is available through the
[`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence") property.

Creating a new tree
:   |  |  |
    | --- | --- |
    | [`Tree.generate_balanced`](#tskit.Tree.generate_balanced "tskit.Tree.generate_balanced")(num\_leaves, \*[, ...]) | Generate a [`Tree`](#tskit.Tree "tskit.Tree") with the specified number of leaves that is maximally balanced. |
    | [`Tree.generate_comb`](#tskit.Tree.generate_comb "tskit.Tree.generate_comb")(num\_leaves, \*[, span, ...]) | Generate a [`Tree`](#tskit.Tree "tskit.Tree") in which all internal nodes have two children and the left child is a leaf. |
    | [`Tree.generate_random_binary`](#tskit.Tree.generate_random_binary "tskit.Tree.generate_random_binary")(num\_leaves, \*[, ...]) | Generate a random binary [`Tree`](#tskit.Tree "tskit.Tree") with \(n\) = `num_leaves` leaves with an equal probability of returning any topology and leaf label permutation among the \((2n - 3)! / (2^{n - 2} (n - 2)!)\) leaf-labelled binary trees. |
    | [`Tree.generate_star`](#tskit.Tree.generate_star "tskit.Tree.generate_star")(num\_leaves, \*[, span, ...]) | Generate a [`Tree`](#tskit.Tree "tskit.Tree") whose leaf nodes all have the same parent (i.e., a "star" tree). |

Creating a new tree from an existing tree
:   |  |  |
    | --- | --- |
    | [`Tree.split_polytomies`](#tskit.Tree.split_polytomies "tskit.Tree.split_polytomies")(\*[, epsilon, method, ...]) | Return a new [`Tree`](#tskit.Tree "tskit.Tree") where extra nodes and edges have been inserted so that any any node `u` with greater than 2 children --- a multifurcation or "polytomy" --- is resolved into successive bifurcations. |

See also

[`Tree.unrank()`](#tskit.Tree.unrank "tskit.Tree.unrank") for creating a new one-tree sequence from its
[topological rank](#sec-python-api-trees-topological-analysis).

Note

Several of these methods are [`static`](https://docs.python.org/3/library/functions.html#staticmethod "(in Python v3.14)"), so should
be called e.g. as `tskit.Tree.generate_balanced(4)` rather than used on
a specific [`Tree`](#tskit.Tree "tskit.Tree") instance.

#### Node measures[#](#node-measures "Link to this heading")

Often it is useful to access information pertinant to a specific node or set of nodes
but which might also change from tree to tree in the tree sequence. Examples include
the encoding of the tree via `parent`, `left_child`, etc.
(see [Tree structure](data-model.html#sec-data-model-tree-structure)), the number of samples under a node,
or the most recent common ancestor (MRCA) of two nodes. This sort of information is
available via simple and high performance [`Tree`](#tskit.Tree "tskit.Tree") methods

##### Simple measures[#](#simple-measures "Link to this heading")

These return a simple number, or (usually) short list of numbers relevant to a specific
node or limited set of nodes.

Node information
:   |  |  |
    | --- | --- |
    | [`Tree.is_sample`](#tskit.Tree.is_sample "tskit.Tree.is_sample")(u) | Returns True if the specified node is a sample. |
    | [`Tree.is_isolated`](#tskit.Tree.is_isolated "tskit.Tree.is_isolated")(u) | Returns True if the specified node is isolated in this tree: that is it has no parents and no children (note that all isolated nodes in the tree are therefore also [`leaves`](#tskit.Tree.is_leaf "tskit.Tree.is_leaf")). |
    | [`Tree.is_leaf`](#tskit.Tree.is_leaf "tskit.Tree.is_leaf")(u) | Returns True if the specified node is a leaf. |
    | [`Tree.is_internal`](#tskit.Tree.is_internal "tskit.Tree.is_internal")(u) | Returns True if the specified node is not a leaf. |
    | [`Tree.parent`](#tskit.Tree.parent "tskit.Tree.parent")(u) | Returns the parent of the specified node. |
    | [`Tree.num_children`](#tskit.Tree.num_children "tskit.Tree.num_children")(u) | Returns the number of children of the specified node (i.e., `len(tree.children(u))`) |
    | [`Tree.time`](#tskit.Tree.time "tskit.Tree.time")(u) | Returns the time of the specified node. |
    | [`Tree.branch_length`](#tskit.Tree.branch_length "tskit.Tree.branch_length")(u) | Returns the length of the branch (in units of time) joining the specified node to its parent. This is equivalent to::. |
    | [`Tree.depth`](#tskit.Tree.depth "tskit.Tree.depth")(u) | Returns the number of nodes on the path from `u` to a root, not including `u`. |
    | [`Tree.population`](#tskit.Tree.population "tskit.Tree.population")(u) | Returns the population associated with the specified node. |
    | [`Tree.right_sib`](#tskit.Tree.right_sib "tskit.Tree.right_sib")(u) | Returns the sibling node to the right of u, or [`tskit.NULL`](#tskit.NULL "tskit.NULL") if u does not have a right sibling. |
    | [`Tree.left_sib`](#tskit.Tree.left_sib "tskit.Tree.left_sib")(u) | Returns the sibling node to the left of u, or [`tskit.NULL`](#tskit.NULL "tskit.NULL") if u does not have a left sibling. |
    | [`Tree.right_child`](#tskit.Tree.right_child "tskit.Tree.right_child")(u) | Returns the rightmost child of the specified node. |
    | [`Tree.left_child`](#tskit.Tree.left_child "tskit.Tree.left_child")(u) | Returns the leftmost child of the specified node. |
    | [`Tree.children`](#tskit.Tree.children "tskit.Tree.children")(u) | Returns the children of the specified node `u` as a tuple of integer node IDs. |
    | [`Tree.edge`](#tskit.Tree.edge "tskit.Tree.edge")(u) | Returns the id of the edge encoding the relationship between `u` and its parent, or [`tskit.NULL`](#tskit.NULL "tskit.NULL") if `u` is a root, virtual root or is not a node in the current tree. |

Descendant nodes
:   |  |  |
    | --- | --- |
    | [`Tree.leaves`](#tskit.Tree.leaves "tskit.Tree.leaves")([u]) | Returns an iterator over all the leaves in this tree that descend from the specified node. |
    | [`Tree.samples`](#tskit.Tree.samples "tskit.Tree.samples")([u]) | Returns an iterator over the numerical IDs of all the sample nodes in this tree that are underneath the node with ID `u`. |
    | [`Tree.num_samples`](#tskit.Tree.num_samples "tskit.Tree.num_samples")([u]) | Returns the number of sample nodes in this tree underneath the specified node (including the node itself). |
    | [`Tree.num_tracked_samples`](#tskit.Tree.num_tracked_samples "tskit.Tree.num_tracked_samples")([u]) | Returns the number of samples in the set specified in the `tracked_samples` parameter of the [`TreeSequence.trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") method underneath the specified node. |

Note that [`Tree.num_samples()`](#tskit.Tree.num_samples "tskit.Tree.num_samples") provides an efficient way to count samples under a node.
However, samples and leaves are not always equivalent: some samples may be internal nodes,
some leaves may not be samples (in unsimplified tree sequences), and the same node can be
a leaf in one tree but internal in another. While `tree.num_samples()` often equals the
leaf count (particularly in simplified tree sequences without internal samples), a strict
leaf count requires tree traversal, e.g. via `num_leaves = len(list(tree.leaves()))`.

Multiple nodes
:   |  |  |
    | --- | --- |
    | [`Tree.is_descendant`](#tskit.Tree.is_descendant "tskit.Tree.is_descendant")(u, v) | Returns True if the specified node u is a descendant of node v and False otherwise. |
    | [`Tree.mrca`](#tskit.Tree.mrca "tskit.Tree.mrca")(\*args) | Returns the most recent common ancestor of the specified nodes. |
    | [`Tree.tmrca`](#tskit.Tree.tmrca "tskit.Tree.tmrca")(\*args) | Returns the time of the most recent common ancestor of the specified nodes. This is equivalent to::. |

##### Array access[#](#array-access "Link to this heading")

These all return a numpy array whose length corresponds to
the total number of nodes in the tree sequence. They provide direct access
to the underlying memory structures, and are thus very efficient, providing a
high performance interface which can be used in conjunction with the equivalent
[traversal methods](#sec-python-api-trees-traversal).

|  |  |
| --- | --- |
| [`Tree.parent_array`](#tskit.Tree.parent_array "tskit.Tree.parent_array") | A numpy array (dtype=np.int32) encoding the parent of each node in this tree, such that `tree.parent_array[u] == tree.parent(u)` for all `0 <= u <= ts.num_nodes`. |
| [`Tree.left_child_array`](#tskit.Tree.left_child_array "tskit.Tree.left_child_array") | A numpy array (dtype=np.int32) encoding the left child of each node in this tree, such that `tree.left_child_array[u] == tree.left_child(u)` for all `0 <= u <= ts.num_nodes`. |
| [`Tree.right_child_array`](#tskit.Tree.right_child_array "tskit.Tree.right_child_array") | A numpy array (dtype=np.int32) encoding the right child of each node in this tree, such that `tree.right_child_array[u] == tree.right_child(u)` for all `0 <= u <= ts.num_nodes`. |
| [`Tree.left_sib_array`](#tskit.Tree.left_sib_array "tskit.Tree.left_sib_array") | A numpy array (dtype=np.int32) encoding the left sib of each node in this tree, such that `tree.left_sib_array[u] == tree.left_sib(u)` for all `0 <= u <= ts.num_nodes`. |
| [`Tree.right_sib_array`](#tskit.Tree.right_sib_array "tskit.Tree.right_sib_array") | A numpy array (dtype=np.int32) encoding the right sib of each node in this tree, such that `tree.right_sib_array[u] == tree.right_sib(u)` for all `0 <= u <= ts.num_nodes`. |
| [`Tree.num_children_array`](#tskit.Tree.num_children_array "tskit.Tree.num_children_array") | A numpy array (dtype=np.int32) encoding the number of children of each node in this tree, such that `tree.num_children_array[u] == tree.num_children(u)` for all `0 <= u <= ts.num_nodes`. |
| [`Tree.edge_array`](#tskit.Tree.edge_array "tskit.Tree.edge_array") | A numpy array (dtype=np.int32) of edge ids encoding the relationship between the child node `u` and its parent, such that `tree.edge_array[u] == tree.edge(u)` for all `0 <= u <= ts.num_nodes`. |

#### Tree traversal[#](#tree-traversal "Link to this heading")

Moving around within a tree usually involves visiting the tree nodes in some sort of
order. Often, given a particular order, it is convenient to iterate over each node
using the [`Tree.nodes()`](#tskit.Tree.nodes "tskit.Tree.nodes") method. However, for high performance algorithms, it
may be more convenient to access the node indices for a particular order as
an array, and use this, for example, to index into one of the node arrays (see
[Visiting nodes](topological-analysis.html#sec-topological-analysis-traversal)). Note that the most efficient of these
methods is [`Tree.preorder()`](#tskit.Tree.preorder "tskit.Tree.preorder").

Iterator access
:   |  |  |
    | --- | --- |
    | [`Tree.nodes`](#tskit.Tree.nodes "tskit.Tree.nodes")([root, order]) | Returns an iterator over the node IDs reachable from the specified node in this tree in the specified traversal order. |
    | [`Tree.ancestors`](#tskit.Tree.ancestors "tskit.Tree.ancestors")(u) | Returns an iterator over the ancestors of node `u` in this tree (i.e. the chain of parents from `u` to the root). |

Array access
:   |  |  |
    | --- | --- |
    | [`Tree.postorder`](#tskit.Tree.postorder "tskit.Tree.postorder")([u]) | Returns a numpy array of node ids in [postorder](https://en.wikipedia.org/wiki/Tree_traversal##Post-order_(LRN)). |
    | [`Tree.preorder`](#tskit.Tree.preorder "tskit.Tree.preorder")([u]) | Returns a numpy array of node ids in [preorder](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order_(NLR)). |
    | [`Tree.timeasc`](#tskit.Tree.timeasc "tskit.Tree.timeasc")([u]) | Returns a numpy array of node ids. |
    | [`Tree.timedesc`](#tskit.Tree.timedesc "tskit.Tree.timedesc")([u]) | Returns a numpy array of node ids. |

#### Topological analysis[#](#sec-python-api-trees-topological-analysis "Link to this heading")

The topology of a tree refers to the simple relationship among samples
(i.e. ignoring branch lengths), see [Identifying and counting topologies](topological-analysis.html#sec-combinatorics) for more details. These
methods provide ways to enumerate and count tree topologies.

Briefly, the position of a tree in the enumeration `all_trees` can be obtained using
the tree’s [`rank()`](#tskit.Tree.rank "tskit.Tree.rank") method. Inversely, a [`Tree`](#tskit.Tree "tskit.Tree") can be constructed
from a position in the enumeration with [`Tree.unrank()`](#tskit.Tree.unrank "tskit.Tree.unrank").

Methods of a tree
:   |  |  |
    | --- | --- |
    | [`Tree.rank`](#tskit.Tree.rank "tskit.Tree.rank")() | Produce the rank of this tree in the enumeration of all leaf-labelled trees of n leaves. |
    | [`Tree.count_topologies`](#tskit.Tree.count_topologies "tskit.Tree.count_topologies")([sample\_sets]) | Calculates the distribution of embedded topologies for every combination of the sample sets in `sample_sets`. |

Functions and static methods
:   |  |  |
    | --- | --- |
    | [`Tree.unrank`](#tskit.Tree.unrank "tskit.Tree.unrank")(num\_leaves, rank, \*[, span, ...]) | Reconstruct the tree of the given `rank` (see [`tskit.Tree.rank()`](#tskit.Tree.rank "tskit.Tree.rank")) with `num_leaves` leaves. |
    | [`all_tree_shapes`](#tskit.all_tree_shapes "tskit.all_tree_shapes")(num\_leaves[, span]) | Generates all unique shapes of trees with `num_leaves` leaves. |
    | [`all_tree_labellings`](#tskit.all_tree_labellings "tskit.all_tree_labellings")(tree[, span]) | Generates all unique labellings of the leaves of a [`tskit.Tree`](#tskit.Tree "tskit.Tree"). |
    | [`all_trees`](#tskit.all_trees "tskit.all_trees")(num\_leaves[, span]) | Generates all unique leaf-labelled trees with `num_leaves` leaves. |

#### Comparing trees[#](#comparing-trees "Link to this heading")

|  |  |
| --- | --- |
| [`Tree.kc_distance`](#tskit.Tree.kc_distance "tskit.Tree.kc_distance")(other[, lambda\_]) | Returns the Kendall-Colijn distance between the specified pair of trees. |
| [`Tree.rf_distance`](#tskit.Tree.rf_distance "tskit.Tree.rf_distance")(other) | Returns the (unweighted) Robinson-Foulds distance between the specified pair of trees, where corresponding samples between the two trees are identified by node ID. |

#### Balance/imbalance indices[#](#balance-imbalance-indices "Link to this heading")

|  |  |
| --- | --- |
| [`Tree.colless_index`](#tskit.Tree.colless_index "tskit.Tree.colless_index")() | Returns the [Colless imbalance index](https://treebalance.wordpress.com/colless-index/) for this tree. |
| [`Tree.sackin_index`](#tskit.Tree.sackin_index "tskit.Tree.sackin_index")() | Returns the [Sackin imbalance index](https://treebalance.wordpress.com/sackin-index/) for this tree. |
| [`Tree.b1_index`](#tskit.Tree.b1_index "tskit.Tree.b1_index")() | Returns the [B1 balance index](https://treebalance.wordpress.com/b₁-index/) for this tree. |
| [`Tree.b2_index`](#tskit.Tree.b2_index "tskit.Tree.b2_index")([base]) | Returns the [B2 balance index](https://treebalance.wordpress.com/b₂-index/) this tree. |

#### Sites and mutations[#](#sites-and-mutations "Link to this heading")

|  |  |
| --- | --- |
| [`Tree.sites`](#tskit.Tree.sites "tskit.Tree.sites")() | Returns an iterator over all the [sites](data-model.html#sec-site-table-definition) in this tree. |
| [`Tree.num_sites`](#tskit.Tree.num_sites "tskit.Tree.num_sites") | Returns the number of sites on this tree. |
| [`Tree.mutations`](#tskit.Tree.mutations "tskit.Tree.mutations")() | Returns an iterator over all the [mutations](data-model.html#sec-mutation-table-definition) in this tree. |
| [`Tree.num_mutations`](#tskit.Tree.num_mutations "tskit.Tree.num_mutations") | Returns the total number of mutations across all sites on this tree. |
| [`Tree.map_mutations`](#tskit.Tree.map_mutations "tskit.Tree.map_mutations")(genotypes, alleles[, ...]) | Given observations for the samples in this tree described by the specified set of genotypes and alleles, return a parsimonious set of state transitions explaining these observations. |

#### Moving to other trees[#](#moving-to-other-trees "Link to this heading")

|  |  |
| --- | --- |
| [`Tree.next`](#tskit.Tree.next "tskit.Tree.next")() | Seeks to the next tree in the sequence. If the tree is in the initial null state we seek to the first tree (equivalent to calling [`first()`](#tskit.Tree.first "tskit.Tree.first")). Calling `next` on the last tree in the sequence results in the tree being cleared back into the null initial state (equivalent to calling [`clear()`](#tskit.Tree.clear "tskit.Tree.clear")). The return value of the function indicates whether the tree is in a non-null state, and can be used to loop over the trees::. |
| [`Tree.prev`](#tskit.Tree.prev "tskit.Tree.prev")() | Seeks to the previous tree in the sequence. If the tree is in the initial null state we seek to the last tree (equivalent to calling [`last()`](#tskit.Tree.last "tskit.Tree.last")). Calling `prev` on the first tree in the sequence results in the tree being cleared back into the null initial state (equivalent to calling [`clear()`](#tskit.Tree.clear "tskit.Tree.clear")). The return value of the function indicates whether the tree is in a non-null state, and can be used to loop over the trees::. |
| [`Tree.first`](#tskit.Tree.first "tskit.Tree.first")() | Seeks to the first tree in the sequence. |
| [`Tree.last`](#tskit.Tree.last "tskit.Tree.last")() | Seeks to the last tree in the sequence. |
| [`Tree.seek`](#tskit.Tree.seek "tskit.Tree.seek")(position[, skip]) | Sets the state to represent the tree that covers the specified position in the parent tree sequence. |
| [`Tree.seek_index`](#tskit.Tree.seek_index "tskit.Tree.seek_index")(index[, skip]) | Sets the state to represent the tree at the specified index in the parent tree sequence. |
| [`Tree.clear`](#tskit.Tree.clear "tskit.Tree.clear")() | Resets this tree back to the initial null state. |

#### Display[#](#id3 "Link to this heading")

|  |  |
| --- | --- |
| [`Tree.draw_svg`](#tskit.Tree.draw_svg "tskit.Tree.draw_svg")([path, size, time\_scale, ...]) | Return an SVG representation of a single tree. |
| [`Tree.draw_text`](#tskit.Tree.draw_text "tskit.Tree.draw_text")([orientation, node\_labels, ...]) | Create a text representation of a tree. |
| [`Tree.__str__`](#tskit.Tree.__str__ "tskit.Tree.__str__")() | Return a plain text summary of a tree in a tree sequence |
| [`Tree._repr_html_`](#tskit.Tree._repr_html_ "tskit.Tree._repr_html_")() | Return an html summary of a tree in a tree sequence. |

#### Export[#](#id4 "Link to this heading")

|  |  |
| --- | --- |
| [`Tree.as_dict_of_dicts`](#tskit.Tree.as_dict_of_dicts "tskit.Tree.as_dict_of_dicts")() | Convert tree to dict of dicts for conversion to a [networkx graph](https://networkx.github.io/documentation/stable/reference/classes/digraph.html). |
| [`Tree.as_newick`](#tskit.Tree.as_newick "tskit.Tree.as_newick")(\*[, root, precision, ...]) | Returns a [newick encoding](https://en.wikipedia.org/wiki/Newick_format) of this tree. For example, a binary tree with 3 leaves generated by [`Tree.generate_balanced(3)`](#tskit.Tree.generate_balanced "tskit.Tree.generate_balanced") encodes as::. |

## Tables and Table Collections[#](#tables-and-table-collections "Link to this heading")

The information required to construct a tree sequence is stored in a collection
of *tables*, each defining a different aspect of the structure of a tree
sequence. These tables are described individually in
[the next section](#sec-tables-api-table). However, these are interrelated,
and so many operations work
on the entire collection of tables, known as a *table collection*.

### `TableCollection` API[#](#tablecollection-api "Link to this heading")

The [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") and [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") classes are
deeply related. A `TreeSequence` instance is based on the information
encoded in a `TableCollection`. Tree sequences are **immutable**, and
provide methods for obtaining trees from the sequence. A `TableCollection`
is **mutable**, and does not have any methods for obtaining trees.
The `TableCollection` class thus allows creation and modification of
tree sequences (see the [Tables and editing](https://tskit.dev/tutorials/tables_and_editing.html#sec-tables "(in Project name not set)") tutorial).

#### General properties[#](#id5 "Link to this heading")

Specific [tables](#sec-tables-api-table) in the [`TableCollection`](#tskit.TableCollection "tskit.TableCollection")
are be accessed using the plural version of their name, so that, for instance, the
individual table can be accessed using `table_collection.individuals`. A table
collection also has other properties containing, for example, number of bytes taken
to store it and the top-level metadata associated with the tree sequence as a whole.

Table access
:   |  |  |
    | --- | --- |
    | [`TableCollection.individuals`](#tskit.TableCollection.individuals "tskit.TableCollection.individuals") | The [Individual Table](data-model.html#sec-individual-table-definition) in this collection. |
    | [`TableCollection.nodes`](#tskit.TableCollection.nodes "tskit.TableCollection.nodes") | The [Node Table](data-model.html#sec-node-table-definition) in this collection. |
    | [`TableCollection.edges`](#tskit.TableCollection.edges "tskit.TableCollection.edges") | The [Edge Table](data-model.html#sec-edge-table-definition) in this collection. |
    | [`TableCollection.migrations`](#tskit.TableCollection.migrations "tskit.TableCollection.migrations") | The [Migration Table](data-model.html#sec-migration-table-definition) in this collection |
    | [`TableCollection.sites`](#tskit.TableCollection.sites "tskit.TableCollection.sites") | The [Site Table](data-model.html#sec-site-table-definition) in this collection. |
    | [`TableCollection.mutations`](#tskit.TableCollection.mutations "tskit.TableCollection.mutations") | The [Mutation Table](data-model.html#sec-mutation-table-definition) in this collection. |
    | [`TableCollection.populations`](#tskit.TableCollection.populations "tskit.TableCollection.populations") | The [Population Table](data-model.html#sec-population-table-definition) in this collection. |
    | [`TableCollection.provenances`](#tskit.TableCollection.provenances "tskit.TableCollection.provenances") | The [Provenance Table](data-model.html#sec-provenance-table-definition) in this collection. |

Other properties
:   |  |  |
    | --- | --- |
    | [`TableCollection.file_uuid`](#tskit.TableCollection.file_uuid "tskit.TableCollection.file_uuid") | The UUID for the file this TableCollection is derived from, or None if not derived from a file. |
    | [`TableCollection.indexes`](#tskit.TableCollection.indexes "tskit.TableCollection.indexes") | The edge insertion and removal indexes. |
    | [`TableCollection.nbytes`](#tskit.TableCollection.nbytes "tskit.TableCollection.nbytes") | Returns the total number of bytes required to store the data in this table collection. |
    | [`TableCollection.table_name_map`](#tskit.TableCollection.table_name_map "tskit.TableCollection.table_name_map") | Returns a dictionary mapping table names to the corresponding table instances. |
    | [`TableCollection.metadata`](#tskit.TableCollection.metadata "tskit.TableCollection.metadata") | The decoded metadata for this object. |
    | [`TableCollection.metadata_bytes`](#tskit.TableCollection.metadata_bytes "tskit.TableCollection.metadata_bytes") | The raw bytes of metadata for this TableCollection |
    | [`TableCollection.metadata_schema`](#tskit.TableCollection.metadata_schema "tskit.TableCollection.metadata_schema") | The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this object. |
    | [`TableCollection.sequence_length`](#tskit.TableCollection.sequence_length "tskit.TableCollection.sequence_length") | The sequence length defining the coordinate space. |
    | [`TableCollection.time_units`](#tskit.TableCollection.time_units "tskit.TableCollection.time_units") | The units used for the time dimension of this TableCollection |

#### Transformation[#](#transformation "Link to this heading")

These methods act in-place to transform the contents of a [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"),
either by modifying the underlying tables (removing, editing, or adding to them) or
by adjusting the table collection so that it meets the
[Valid tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements).

##### Modification[#](#modification "Link to this heading")

These methods modify the data stored in a [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"). They also have
[equivalant TreeSequence versions](#sec-python-api-tree-sequences-modification)
(unlike the methods described below those do *not* operate in place, but rather act in
a functional way, returning a new tree sequence while leaving the original unchanged).

|  |  |
| --- | --- |
| [`TableCollection.clear`](#tskit.TableCollection.clear "tskit.TableCollection.clear")([clear\_provenance, ...]) | Remove all rows of the data tables, optionally remove provenance, metadata schemas and ts-level metadata. |
| [`TableCollection.simplify`](#tskit.TableCollection.simplify "tskit.TableCollection.simplify")([samples, ...]) | Simplifies the tables in place to retain only the information necessary to reconstruct the tree sequence describing the given `samples`. |
| [`TableCollection.subset`](#tskit.TableCollection.subset "tskit.TableCollection.subset")(nodes[, ...]) | Modifies the tables in place to contain only the entries referring to the provided list of node IDs, with nodes reordered according to the order they appear in the list. |
| [`TableCollection.delete_intervals`](#tskit.TableCollection.delete_intervals "tskit.TableCollection.delete_intervals")(intervals) | Delete all information from this set of tables which lies *within* the specified list of genomic intervals. |
| [`TableCollection.keep_intervals`](#tskit.TableCollection.keep_intervals "tskit.TableCollection.keep_intervals")(intervals[, ...]) | Delete all information from this set of tables which lies *outside* the specified list of genomic intervals. |
| [`TableCollection.delete_sites`](#tskit.TableCollection.delete_sites "tskit.TableCollection.delete_sites")(site\_ids[, ...]) | Remove the specified sites entirely from the sites and mutations tables in this collection. |
| [`TableCollection.trim`](#tskit.TableCollection.trim "tskit.TableCollection.trim")([record\_provenance]) | Trim away any empty regions on the right and left of the tree sequence encoded by these tables. |
| [`TableCollection.shift`](#tskit.TableCollection.shift "tskit.TableCollection.shift")(value, \*[, ...]) | Shift the coordinate system (used by edges, sites, and migrations) of this TableCollection by a given value. |
| [`TableCollection.union`](#tskit.TableCollection.union "tskit.TableCollection.union")(other, node\_mapping[, ...]) | Modifies the table collection in place by adding the non-shared portions of `other` to itself. |
| [`TableCollection.delete_older`](#tskit.TableCollection.delete_older "tskit.TableCollection.delete_older")(time) | Deletes edge, mutation and migration information at least as old as the specified time. |

##### Creating a valid tree sequence[#](#creating-a-valid-tree-sequence "Link to this heading")

These methods can be used to help reorganise or rationalise the
[`TableCollection`](#tskit.TableCollection "tskit.TableCollection") so that it is in the form
[required](data-model.html#sec-valid-tree-sequence-requirements) for
it to be [`converted`](#tskit.TableCollection.tree_sequence "tskit.TableCollection.tree_sequence")
into a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence"). This may require sorting the tables,
ensuring they are logically consistent, and adding [Table indexes](data-model.html#sec-table-indexes).

Note

These methods are not guaranteed to make valid a [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") which is
logically inconsistent, for example if multiple edges have the same child at a
given position on the genome or if non-existent node IDs are referenced.

Sorting
:   |  |  |
    | --- | --- |
    | [`TableCollection.sort`](#tskit.TableCollection.sort "tskit.TableCollection.sort")([edge\_start, ...]) | Sorts the tables in place. |
    | [`TableCollection.sort_individuals`](#tskit.TableCollection.sort_individuals "tskit.TableCollection.sort_individuals")() | Sorts the individual table in place, so that parents come before children, and the parent column is remapped as required. |
    | [`TableCollection.canonicalise`](#tskit.TableCollection.canonicalise "tskit.TableCollection.canonicalise")([...]) | This puts the tables in *canonical* form, imposing a stricter order on the tables than [required](data-model.html#sec-valid-tree-sequence-requirements) for a valid tree sequence. |

Logical consistency
:   |  |  |
    | --- | --- |
    | [`TableCollection.compute_mutation_parents`](#tskit.TableCollection.compute_mutation_parents "tskit.TableCollection.compute_mutation_parents")() | Modifies the tables in place, computing the `parent` column of the mutation table. |
    | [`TableCollection.compute_mutation_times`](#tskit.TableCollection.compute_mutation_times "tskit.TableCollection.compute_mutation_times")() | Modifies the tables in place, computing valid values for the `time` column of the mutation table. |
    | [`TableCollection.deduplicate_sites`](#tskit.TableCollection.deduplicate_sites "tskit.TableCollection.deduplicate_sites")() | Modifies the tables in place, removing entries in the site table with duplicate `position` (and keeping only the *first* entry for each site), and renumbering the `site` column of the mutation table appropriately. |

Indexing
:   |  |  |
    | --- | --- |
    | [`TableCollection.has_index`](#tskit.TableCollection.has_index "tskit.TableCollection.has_index")() | Returns True if this TableCollection is indexed. |
    | [`TableCollection.build_index`](#tskit.TableCollection.build_index "tskit.TableCollection.build_index")() | Builds an index on this TableCollection. |
    | [`TableCollection.drop_index`](#tskit.TableCollection.drop_index "tskit.TableCollection.drop_index")() | Drops any indexes present on this table collection. |

#### Miscellaneous methods[#](#miscellaneous-methods "Link to this heading")

|  |  |
| --- | --- |
| [`TableCollection.copy`](#tskit.TableCollection.copy "tskit.TableCollection.copy")() | Returns a deep copy of this TableCollection. |
| [`TableCollection.equals`](#tskit.TableCollection.equals "tskit.TableCollection.equals")(other, \*[, ...]) | Returns True if self and other are equal. |
| [`TableCollection.link_ancestors`](#tskit.TableCollection.link_ancestors "tskit.TableCollection.link_ancestors")(samples, ...) | Returns an [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") instance describing a subset of the genealogical relationships between the nodes in `samples` and `ancestors`. |

#### Export[#](#id6 "Link to this heading")

|  |  |
| --- | --- |
| [`TableCollection.tree_sequence`](#tskit.TableCollection.tree_sequence "tskit.TableCollection.tree_sequence")() | Returns a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance from the tables defined in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"), building the required indexes if they have not yet been created by [`build_index()`](#tskit.TableCollection.build_index "tskit.TableCollection.build_index"). |
| [`TableCollection.dump`](#tskit.TableCollection.dump "tskit.TableCollection.dump")(file\_or\_path) | Writes the table collection to the specified path or file object. |

### Table APIs[#](#table-apis "Link to this heading")

Here we outline the table classes and the common methods and variables available for
each. For description and definition of each table’s meaning
and use, see [the table definitions](data-model.html#sec-table-definitions).

|  |  |
| --- | --- |
| [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable")([max\_rows\_increment, ll\_table]) | A table defining the individuals in a tree sequence. |
| [`NodeTable`](#tskit.NodeTable "tskit.NodeTable")([max\_rows\_increment, ll\_table]) | A table defining the nodes in a tree sequence. |
| [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable")([max\_rows\_increment, ll\_table]) | A table defining the edges in a tree sequence. |
| [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable")([max\_rows\_increment, ll\_table]) | A table defining the migrations in a tree sequence. |
| [`SiteTable`](#tskit.SiteTable "tskit.SiteTable")([max\_rows\_increment, ll\_table]) | A table defining the sites in a tree sequence. |
| [`MutationTable`](#tskit.MutationTable "tskit.MutationTable")([max\_rows\_increment, ll\_table]) | A table defining the mutations in a tree sequence. |
| [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable")([max\_rows\_increment, ll\_table]) | A table defining the populations referred to in a tree sequence. |
| [`ProvenanceTable`](#tskit.ProvenanceTable "tskit.ProvenanceTable")([max\_rows\_increment, ll\_table]) | A table recording the provenance (i.e., history) of this table, so that the origin of the underlying data and sequence of subsequent operations can be traced. |

#### Accessing table data[#](#accessing-table-data "Link to this heading")

The tables API provides an efficient way of working
with and interchanging [tree sequence data](data-model.html#sec-data-model). Each table class
(e.g, [`NodeTable`](#tskit.NodeTable "tskit.NodeTable"), [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable"), [`SiteTable`](#tskit.SiteTable "tskit.SiteTable")) has a specific set
of columns with fixed types, and a set of methods for setting and getting the data
in these columns. The number of rows in the table `t` is given by `len(t)`.

```python
import tskit
t = tskit.EdgeTable()
t.add_row(left=0, right=1, parent=10, child=11)
t.add_row(left=1, right=2, parent=9, child=11)
print("The table contains", len(t), "rows")
print(t)
```

```python
The table contains 2 rows
╔══╤════╤═════╤══════╤═════╤════════╗
║id│left│right│parent│child│metadata║
╠══╪════╪═════╪══════╪═════╪════════╣
║0 │   0│    1│    10│   11│        ║
║1 │   1│    2│     9│   11│        ║
╚══╧════╧═════╧══════╧═════╧════════╝
```

Each table supports accessing the data either by row or column. To access the data in
a *column*, we can use standard attribute access which will
return a copy of the column data as a numpy array:

```python
t.left
```

```python
array([0., 1.])
```

```python
t.parent
```

```python
array([10,  9], dtype=int32)
```

To access the data in a *row*, say row number `j` in table `t`, simply use `t[j]`:

```python
t[0]
```

```python
EdgeTableRow(left=0.0, right=1.0, parent=10, child=11, metadata=b'')
```

This also works as expected with negative `j`, counting rows from the end of the table

```python
t[-1]
```

```python
EdgeTableRow(left=1.0, right=2.0, parent=9, child=11, metadata=b'')
```

The returned row has attributes allowing contents to be accessed by name, e.g.
`site_table[0].position`, `site_table[0].ancestral_state`, `site_table[0].metadata`
etc.:

```python
t[-1].right
```

```python
2.0
```

Row attributes cannot be modified directly. Instead, the `replace` method of a row
object can be used to create a new row with one or more changed column
values, which can then be used to replace the original. For example:

```python
t[-1] = t[-1].replace(child=4, right=3)
print(t)
```

```python
╔══╤════╤═════╤══════╤═════╤════════╗
║id│left│right│parent│child│metadata║
╠══╪════╪═════╪══════╪═════╪════════╣
║0 │   0│    1│    10│   11│        ║
║1 │   1│    3│     9│    4│        ║
╚══╧════╧═════╧══════╧═════╧════════╝
```

Tables also support the [`pickle`](https://docs.python.org/3/library/pickle.html#module-pickle "(in Python v3.14)") protocol, and so can be easily serialised and
deserialised. This can be useful, for example, when performing parallel computations
using the [`multiprocessing`](https://docs.python.org/3/library/multiprocessing.html#module-multiprocessing "(in Python v3.14)") module (however, pickling will not be as efficient
as storing tables in the native [format](file-formats.html#sec-tree-sequence-file-format)).

```python
import pickle
serialised = pickle.dumps(t)
t2 = pickle.loads(serialised)
print(t2)
```

```python
╔══╤════╤═════╤══════╤═════╤════════╗
║id│left│right│parent│child│metadata║
╠══╪════╪═════╪══════╪═════╪════════╣
║0 │   0│    1│    10│   11│        ║
║1 │   1│    3│     9│    4│        ║
╚══╧════╧═════╧══════╧═════╧════════╝
```

Tables support the equality operator `==` based on the data
held in the columns:

```python
t == t2
```

```python
1
```

```python
t is t2
```

```python
False
```

```python
t2.add_row(0, 1, 2, 3)
print(t2)
t == t2
```

```python
╔══╤════╤═════╤══════╤═════╤════════╗
║id│left│right│parent│child│metadata║
╠══╪════╪═════╪══════╪═════╪════════╣
║0 │   0│    1│    10│   11│        ║
║1 │   1│    3│     9│    4│        ║
║2 │   0│    1│     2│    3│        ║
╚══╧════╧═════╧══════╧═════╧════════╝
```

```python
0
```

Todo

Move some or all of these examples into a suitable alternative chapter.

##### Text columns[#](#text-columns "Link to this heading")

As described in the [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns), working with
variable length columns is somewhat more involved. Columns
encoding text data store the **encoded bytes** of the flattened
strings, and the offsets into this column in two separate
arrays.

Consider the following example:

```python
t = tskit.SiteTable()
t.add_row(0, "A")
t.add_row(1, "BB")
t.add_row(2, "")
t.add_row(3, "CCC")
print(t)
print(t[0])
print(t[1])
print(t[2])
print(t[3])
```

```python
╔══╤════════╤═══════════════╤════════╗
║id│position│ancestral_state│metadata║
╠══╪════════╪═══════════════╪════════╣
║0 │       0│              A│        ║
║1 │       1│             BB│        ║
║2 │       2│               │        ║
║3 │       3│            CCC│        ║
╚══╧════════╧═══════════════╧════════╝

SiteTableRow(position=0.0, ancestral_state='A', metadata=b'')
SiteTableRow(position=1.0, ancestral_state='BB', metadata=b'')
SiteTableRow(position=2.0, ancestral_state='', metadata=b'')
SiteTableRow(position=3.0, ancestral_state='CCC', metadata=b'')
```

Here we create a [`SiteTable`](#tskit.SiteTable "tskit.SiteTable") and add four rows, each with a different
`ancestral_state`. We can then access this information from each
row in a straightforward manner. Working with columns of text data
is a little trickier, however:

```python
print(t.ancestral_state)
print(t.ancestral_state_offset)
```

```python
[65 66 66 67 67 67]
[0 1 3 3 6]
```

```python
tskit.unpack_strings(t.ancestral_state, t.ancestral_state_offset)
```

```python
['A', 'BB', '', 'CCC']
```

Here, the `ancestral_state` array is the UTF8 encoded bytes of the flattened
strings, and the `ancestral_state_offset` is the offset into this array
for each row. The [`tskit.unpack_strings()`](#tskit.unpack_strings "tskit.unpack_strings") function, however, is a convient
way to recover the original strings from this encoding. We can also use the
[`tskit.pack_strings()`](#tskit.pack_strings "tskit.pack_strings") to insert data using this approach:

```python
a, off = tskit.pack_strings(["0", "12", ""])
t.set_columns(position=[0, 1, 2], ancestral_state=a, ancestral_state_offset=off)
print(t)
```

```python
╔══╤════════╤═══════════════╤════════╗
║id│position│ancestral_state│metadata║
╠══╪════════╪═══════════════╪════════╣
║0 │       0│              0│        ║
║1 │       1│             12│        ║
║2 │       2│               │        ║
╚══╧════════╧═══════════════╧════════╝
```

When inserting many rows with standard infinite sites mutations (i.e.,
ancestral state is “0”), it is more efficient to construct the
numpy arrays directly than to create a list of strings and use
[`pack_strings()`](#tskit.pack_strings "tskit.pack_strings"). When doing this, it is important to note that
it is the **encoded** byte values that are stored; by default, we
use UTF8 (which corresponds to ASCII for simple printable characters).:

```python
import numpy as np
t_s = tskit.SiteTable()
m = 10
a = ord("0") + np.zeros(m, dtype=np.int8)
off = np.arange(m + 1, dtype=np.uint32)
t_s.set_columns(position=np.arange(m), ancestral_state=a, ancestral_state_offset=off)
print(t_s)
print("ancestral state data", t_s.ancestral_state)
print("ancestral state offsets", t_s.ancestral_state_offset)
```

```python
╔══╤════════╤═══════════════╤════════╗
║id│position│ancestral_state│metadata║
╠══╪════════╪═══════════════╪════════╣
║0 │       0│              0│        ║
║1 │       1│              0│        ║
║2 │       2│              0│        ║
║3 │       3│              0│        ║
║4 │       4│              0│        ║
║5 │       5│              0│        ║
║6 │       6│              0│        ║
║7 │       7│              0│        ║
║8 │       8│              0│        ║
║9 │       9│              0│        ║
╚══╧════════╧═══════════════╧════════╝

ancestral state data [48 48 48 48 48 48 48 48 48 48]
ancestral state offsets [ 0  1  2  3  4  5  6  7  8  9 10]
```

In the mutation table, the derived state of each mutation can be handled similarly:

```python
t_m = tskit.MutationTable()
site = np.arange(m, dtype=np.int32)
d, off = tskit.pack_strings(["1"] * m)
node = np.zeros(m, dtype=np.int32)
t_m.set_columns(site=site, node=node, derived_state=d, derived_state_offset=off)
print(t_m)
```

```python
╔══╤════╤════╤════╤═════════════╤══════╤════════╗
║id│site│node│time│derived_state│parent│metadata║
╠══╪════╪════╪════╪═════════════╪══════╪════════╣
║0 │   0│   0│ nan│            1│    -1│        ║
║1 │   1│   0│ nan│            1│    -1│        ║
║2 │   2│   0│ nan│            1│    -1│        ║
║3 │   3│   0│ nan│            1│    -1│        ║
║4 │   4│   0│ nan│            1│    -1│        ║
║5 │   5│   0│ nan│            1│    -1│        ║
║6 │   6│   0│ nan│            1│    -1│        ║
║7 │   7│   0│ nan│            1│    -1│        ║
║8 │   8│   0│ nan│            1│    -1│        ║
║9 │   9│   0│ nan│            1│    -1│        ║
╚══╧════╧════╧════╧═════════════╧══════╧════════╝
```

Todo

Move some or all of these examples into a suitable alternative chapter.

##### Binary columns[#](#binary-columns "Link to this heading")

Columns storing binary data take the same approach as
[Text columns](#sec-tables-api-text-columns) to encoding
[variable length data](data-model.html#sec-encoding-ragged-columns).
The difference between the two is only raw [`bytes`](https://docs.python.org/3/library/stdtypes.html#bytes "(in Python v3.14)") values are accepted: no
character encoding or decoding is done on the data. Consider the following example
where a table has no `metadata_schema` such that arbitrary bytes can be stored and
no automatic encoding or decoding of objects is performed by the Python API and we can
store and retrieve raw `bytes`. (See [Metadata](metadata.html#sec-metadata) for details):

Below, we add two rows to a [`NodeTable`](#tskit.NodeTable "tskit.NodeTable"), with different
[metadata](data-model.html#sec-metadata-definition). The first row contains a simple
byte string, and the second contains a Python dictionary serialised using
[`pickle`](https://docs.python.org/3/library/pickle.html#module-pickle "(in Python v3.14)").

```python
t = tskit.NodeTable()
t.add_row(metadata=b"these are raw bytes")
t.add_row(metadata=pickle.dumps({"x": 1.1}))
print(t)
```

```python
╔══╤════╤═════╤══════════╤══════════╤════════════════════════════════════════╗
║id│time│flags│population│individual│metadata                                ║
╠══╪════╪═════╪══════════╪══════════╪════════════════════════════════════════╣
║0 │   0│    0│        -1│        -1│                  b'these are raw bytes'║
║1 │   0│    0│        -1│        -1│b'\x80\x04\x95\x11\x00\x00\x00\x00\x0...║
╚══╧════╧═════╧══════════╧══════════╧════════════════════════════════════════╝
```

Note that the pickled dictionary is encoded in 24 bytes containing unprintable
characters. It appears to be unrelated to the original contents, because the binary
data is [base64 encoded](https://en.wikipedia.org/wiki/Base64) to ensure that it is
print-safe (and doesn’t break your terminal). (See the
[Metadata](data-model.html#sec-metadata-definition) section for more information on the
use of base64 encoding.).

We can access the metadata in a row (e.g., `t[0].metadata`) which returns a Python
bytes object containing precisely the bytes that were inserted.

```python
print(t[0].metadata)
print(t[1].metadata)
```

```python
b'these are raw bytes'
b'\x80\x04\x95\x11\x00\x00\x00\x00\x00\x00\x00}\x94\x8c\x01x\x94G?\xf1\x99\x99\x99\x99\x99\x9as.'
```

The metadata containing the pickled dictionary can be unpickled using
[`pickle.loads()`](https://docs.python.org/3/library/pickle.html#pickle.loads "(in Python v3.14)"):

```python
print(pickle.loads(t[1].metadata))
```

```python
{'x': 1.1}
```

As previously, the `replace` method can be used to change the metadata,
by overwriting an existing row with an updated one:

```python
t[0] = t[0].replace(metadata=b"different raw bytes")
print(t)
```

```python
╔══╤════╤═════╤══════════╤══════════╤════════════════════════════════════════╗
║id│time│flags│population│individual│metadata                                ║
╠══╪════╪═════╪══════════╪══════════╪════════════════════════════════════════╣
║0 │   0│    0│        -1│        -1│                  b'different raw bytes'║
║1 │   0│    0│        -1│        -1│b'\x80\x04\x95\x11\x00\x00\x00\x00\x0...║
╚══╧════╧═════╧══════════╧══════════╧════════════════════════════════════════╝
```

Finally, when we print the `metadata` column, we see the raw byte values
encoded as signed integers. As for [Text columns](#sec-tables-api-text-columns),
the `metadata_offset` column encodes the offsets into this array. So, we
see that the first metadata value is 9 bytes long and the second is 24.

```python
print(t.metadata)
print(t.metadata_offset)
```

```python
[ 100  105  102  102  101  114  101  110  116   32  114   97  119   32
   98  121  116  101  115 -128    4 -107   17    0    0    0    0    0
    0    0  125 -108 -116    1  120 -108   71   63  -15 -103 -103 -103
 -103 -103 -102  115   46]
[ 0 19 47]
```

The [`tskit.pack_bytes()`](#tskit.pack_bytes "tskit.pack_bytes") and [`tskit.unpack_bytes()`](#tskit.unpack_bytes "tskit.unpack_bytes") functions are
also useful for encoding data in these columns.

Todo

Move some or all of these examples into a suitable alternative chapter.

#### Table functions[#](#table-functions "Link to this heading")

|  |  |
| --- | --- |
| [`parse_nodes`](#tskit.parse_nodes "tskit.parse_nodes")(source[, strict, encoding, ...]) | Parse the specified file-like object containing a whitespace delimited description of a node table and returns the corresponding [`NodeTable`](#tskit.NodeTable "tskit.NodeTable") instance. |
| [`parse_edges`](#tskit.parse_edges "tskit.parse_edges")(source[, strict, table, ...]) | Parse the specified file-like object containing a whitespace delimited description of a edge table and returns the corresponding [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") instance. |
| [`parse_sites`](#tskit.parse_sites "tskit.parse_sites")(source[, strict, encoding, ...]) | Parse the specified file-like object containing a whitespace delimited description of a site table and returns the corresponding [`SiteTable`](#tskit.SiteTable "tskit.SiteTable") instance. |
| [`parse_mutations`](#tskit.parse_mutations "tskit.parse_mutations")(source[, strict, encoding, ...]) | Parse the specified file-like object containing a whitespace delimited description of a mutation table and returns the corresponding [`MutationTable`](#tskit.MutationTable "tskit.MutationTable") instance. |
| [`parse_individuals`](#tskit.parse_individuals "tskit.parse_individuals")(source[, strict, ...]) | Parse the specified file-like object containing a whitespace delimited description of an individual table and returns the corresponding [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable") instance. |
| [`parse_populations`](#tskit.parse_populations "tskit.parse_populations")(source[, strict, ...]) | Parse the specified file-like object containing a whitespace delimited description of a population table and returns the corresponding [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable") instance. |
| [`parse_migrations`](#tskit.parse_migrations "tskit.parse_migrations")(source[, strict, encoding, ...]) | Parse the specified file-like object containing a whitespace delimited description of a migration table and returns the corresponding [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable") instance. |
| [`pack_strings`](#tskit.pack_strings "tskit.pack_strings")(strings[, encoding]) | Packs the specified list of strings into a flattened numpy array of 8 bit integers and corresponding offsets using the specified text encoding. |
| [`unpack_strings`](#tskit.unpack_strings "tskit.unpack_strings")(packed, offset[, encoding]) | Unpacks a list of strings from the specified numpy arrays of packed byte data and corresponding offsets using the specified text encoding. |
| [`pack_bytes`](#tskit.pack_bytes "tskit.pack_bytes")(data) | Packs the specified list of bytes into a flattened numpy array of 8 bit integers and corresponding offsets. |
| [`unpack_bytes`](#tskit.unpack_bytes "tskit.unpack_bytes")(packed, offset) | Unpacks a list of bytes from the specified numpy arrays of packed byte data and corresponding offsets. |

## Metadata API[#](#metadata-api "Link to this heading")

The `metadata` module provides validation, encoding and decoding of metadata
using a schema. See [Metadata](metadata.html#sec-metadata), [Python Metadata API Overview](metadata.html#sec-metadata-api-overview) and
[Working with Metadata](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata "(in Project name not set)").

|  |  |
| --- | --- |
| [`MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema")(schema) | Class for validating, encoding and decoding metadata. |
| [`register_metadata_codec`](#tskit.register_metadata_codec "tskit.register_metadata_codec")(codec\_cls, codec\_id) | Register a metadata codec class. |

See also

Refer to the top level metadata-related properties of TreeSequences and TableCollections,
such as [`TreeSequence.metadata`](#tskit.TreeSequence.metadata "tskit.TreeSequence.metadata") and [`TreeSequence.metadata_schema`](#tskit.TreeSequence.metadata_schema "tskit.TreeSequence.metadata_schema"). Also the
metadata fields of
[objects accessed](#sec-python-api-tree-sequences-obtaining-other-objects) through
the [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") API.

## Provenance[#](#provenance "Link to this heading")

We provide some preliminary support for validating JSON documents against the
[provenance schema](provenance.html#sec-provenance). Programmatic access to provenance
information is planned for future versions.

|  |  |
| --- | --- |
| [`validate_provenance`](#tskit.validate_provenance "tskit.validate_provenance")(provenance) | Validates the specified dict-like object against the tskit [provenance schema](provenance.html#sec-provenance). |

## Utility functions[#](#utility-functions "Link to this heading")

Miscellaneous top-level utility functions.

|  |  |
| --- | --- |
| [`is_unknown_time`](#tskit.is_unknown_time "tskit.is_unknown_time")(time) | As the default unknown mutation time ([`UNKNOWN_TIME`](#tskit.UNKNOWN_TIME "tskit.UNKNOWN_TIME")) is a specific NAN value, equality always fails (A NAN value is not equal to itself by definition). |
| [`random_nucleotides`](#tskit.random_nucleotides "tskit.random_nucleotides")(length, \*[, seed]) | Returns a random string of nucleotides of the specified length. |

## Reference documentation[#](#reference-documentation "Link to this heading")

### Constants[#](#constants "Link to this heading")

The following constants are used throughout the `tskit` API.

tskit.NULL *= -1*[#](#tskit.NULL "Link to this definition")
:   Special reserved value representing a null ID.

tskit.MISSING\_DATA *= -1*[#](#tskit.MISSING_DATA "Link to this definition")
:   Special value representing missing data in a genotype array

tskit.NODE\_IS\_SAMPLE *= 1*[#](#tskit.NODE_IS_SAMPLE "Link to this definition")
:   Node flag value indicating that it is a sample.

tskit.FORWARD *= 1*[#](#tskit.FORWARD "Link to this definition")
:   Constant representing the forward direction of travel (i.e.,
    increasing genomic coordinate values).

tskit.REVERSE *= -1*[#](#tskit.REVERSE "Link to this definition")
:   Constant representing the reverse direction of travel (i.e.,
    decreasing genomic coordinate values).

tskit.ALLELES\_01 *= ('0', '1')*[#](#tskit.ALLELES_01 "Link to this definition")
:   The allele mapping where the strings “0” and “1” map to genotype
    values 0 and 1.

tskit.ALLELES\_ACGT *= ('A', 'C', 'G', 'T')*[#](#tskit.ALLELES_ACGT "Link to this definition")
:   The allele mapping where the four nucleotides A, C, G and T map to
    the genotype integers 0, 1, 2, and 3, respectively.

tskit.UNKNOWN\_TIME *= nan*[#](#tskit.UNKNOWN_TIME "Link to this definition")
:   Special NAN value used to indicate unknown mutation times. Since this is a
    NAN value, you cannot use == to test for it. Use [`is_unknown_time()`](#tskit.is_unknown_time "tskit.is_unknown_time") instead.

tskit.TIME\_UNITS\_UNKNOWN *= 'unknown'*[#](#tskit.TIME_UNITS_UNKNOWN "Link to this definition")
:   Default value of ts.time\_units

tskit.TIME\_UNITS\_UNCALIBRATED *= 'uncalibrated'*[#](#tskit.TIME_UNITS_UNCALIBRATED "Link to this definition")
:   ts.time\_units value when dimension is uncalibrated

### Exceptions[#](#exceptions "Link to this heading")

*exception* tskit.DuplicatePositionsError[[source]](_modules/tskit/exceptions.html#DuplicatePositionsError)[#](#tskit.DuplicatePositionsError "Link to this definition")
:   Duplicate positions in the list of sites.

*exception* tskit.MetadataEncodingError[[source]](_modules/tskit/exceptions.html#MetadataEncodingError)[#](#tskit.MetadataEncodingError "Link to this definition")
:   A metadata object was of a type that could not be encoded

*exception* tskit.MetadataSchemaValidationError[[source]](_modules/tskit/exceptions.html#MetadataSchemaValidationError)[#](#tskit.MetadataSchemaValidationError "Link to this definition")
:   A metadata schema object did not validate against the metaschema.

*exception* tskit.MetadataValidationError[[source]](_modules/tskit/exceptions.html#MetadataValidationError)[#](#tskit.MetadataValidationError "Link to this definition")
:   A metadata object did not validate against the provenance schema.

*exception* tskit.ProvenanceValidationError[[source]](_modules/tskit/exceptions.html#ProvenanceValidationError)[#](#tskit.ProvenanceValidationError "Link to this definition")
:   A JSON document did not validate against the provenance schema.

### Top-level functions[#](#top-level-functions "Link to this heading")

tskit.all\_trees(*num\_leaves*, *span=1*)[[source]](_modules/tskit/combinatorics.html#all_trees)[#](#tskit.all_trees "Link to this definition")
:   Generates all unique leaf-labelled trees with `num_leaves`
    leaves. See [Identifying and counting topologies](topological-analysis.html#sec-combinatorics) on the details of this
    enumeration. The leaf labels are selected from the set
    `[0, num_leaves)`. The times and labels on internal nodes are
    chosen arbitrarily.

    Parameters:
    :   - **num\_leaves** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of leaves of the tree to generate.
        - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The genomic span of each returned tree.

    Return type:
    :   [tskit.Tree](#tskit.Tree "tskit.Tree")

tskit.all\_tree\_shapes(*num\_leaves*, *span=1*)[[source]](_modules/tskit/combinatorics.html#all_tree_shapes)[#](#tskit.all_tree_shapes "Link to this definition")
:   Generates all unique shapes of trees with `num_leaves` leaves.

    Parameters:
    :   - **num\_leaves** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of leaves of the tree to generate.
        - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The genomic span of each returned tree.

    Return type:
    :   [tskit.Tree](#tskit.Tree "tskit.Tree")

tskit.all\_tree\_labellings(*tree*, *span=1*)[[source]](_modules/tskit/combinatorics.html#all_tree_labellings)[#](#tskit.all_tree_labellings "Link to this definition")
:   Generates all unique labellings of the leaves of a
    [`tskit.Tree`](#tskit.Tree "tskit.Tree"). Leaves are labelled from the set
    `[0, n)` where `n` is the number of leaves of `tree`.

    Parameters:
    :   - **tree** ([*tskit.Tree*](#tskit.Tree "tskit.Tree")) – The tree used to generate
          labelled trees of the same shape.
        - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The genomic span of each returned tree.

    Return type:
    :   [tskit.Tree](#tskit.Tree "tskit.Tree")

tskit.is\_unknown\_time(*time*)[[source]](_modules/tskit/util.html#is_unknown_time)[#](#tskit.is_unknown_time "Link to this definition")
:   As the default unknown mutation time ([`UNKNOWN_TIME`](#tskit.UNKNOWN_TIME "tskit.UNKNOWN_TIME")) is a specific NAN value,
    equality always fails (A NAN value is not equal to itself by definition).
    This method compares the bitfield such that unknown times can be detected. Either
    single floats can be passed or lists/arrays.

    Note that NANs are a set of floating-point values. tskit.UNKNOWN\_TIME is a specific
    value in this set. np.nan is a differing value, but both are NAN.
    See <https://en.wikipedia.org/wiki/NaN>

    This function only returns true for `tskit.is_unknown_time(tskit.UNKNOWN_TIME)`
    and will return false for `tskit.is_unknown_time(np.nan)` or any other NAN or
    non-NAN value.

    Parameters:
    :   **time** (*Union**[*[*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")*,* *array-like**]*) – Value or array to check.

    Returns:
    :   A single boolean or array of booleans the same shape as `time`.

    Return type:
    :   Union[[bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)"), [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")[[bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")]]

tskit.load(*file*, *\**, *skip\_tables=False*, *skip\_reference\_sequence=False*)[[source]](_modules/tskit/trees.html#load)[#](#tskit.load "Link to this definition")
:   Return a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance loaded from the specified file object or
    path. The file must be in the
    [tree sequence file format](file-formats.html#sec-tree-sequence-file-format)
    produced by the [`TreeSequence.dump()`](#tskit.TreeSequence.dump "tskit.TreeSequence.dump") method.

    Warning

    With any of the `skip_tables` or `skip_reference_sequence`
    options set, it is not possible to load data from a non-seekable stream
    (e.g. a socket or STDIN) of multiple tree sequences using consecutive
    calls to [`tskit.load()`](#tskit.load "tskit.load").

    Parameters:
    :   - **file** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The file object or path of the `.trees` file containing the
          tree sequence we wish to load.
        - **skip\_tables** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, no tables are read from the `.trees`
          file and only the top-level information is populated in the tree
          sequence object.
        - **skip\_reference\_sequence** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the tree sequence is read
          without loading its reference sequence.

    Returns:
    :   The tree sequence object containing the information
        stored in the specified file path.

    Return type:
    :   [`tskit.TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence")

tskit.load\_text(*nodes*, *edges*, *sites=None*, *mutations=None*, *individuals=None*, *populations=None*, *migrations=None*, *sequence\_length=0*, *strict=True*, *encoding='utf8'*, *base64\_metadata=True*)[[source]](_modules/tskit/trees.html#load_text)[#](#tskit.load_text "Link to this definition")
:   Return a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance parsed from tabulated text data
    contained in the specified file-like objects. The format
    for these files is documented in the [Text file formats](file-formats.html#sec-text-file-format) section,
    and is produced by the [`TreeSequence.dump_text()`](#tskit.TreeSequence.dump_text "tskit.TreeSequence.dump_text") method. Further
    properties required for an input tree sequence are described in the
    [Valid tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements) section. This method is intended as a
    convenient interface for importing external data into tskit; the binary
    file format using by [`tskit.load()`](#tskit.load "tskit.load") is many times more efficient than
    this text format.

    The `nodes` and `edges` parameters are mandatory and must be file-like
    objects containing text with whitespace delimited columns, parsable by
    [`parse_nodes()`](#tskit.parse_nodes "tskit.parse_nodes") and [`parse_edges()`](#tskit.parse_edges "tskit.parse_edges"), respectively. `sites`,
    `individuals`, `populations`, `mutations`, and `migrations` are optional,
    and must be parsable by [`parse_sites()`](#tskit.parse_sites "tskit.parse_sites"), [`parse_individuals()`](#tskit.parse_individuals "tskit.parse_individuals"),
    [`parse_populations()`](#tskit.parse_populations "tskit.parse_populations"), [`parse_mutations()`](#tskit.parse_mutations "tskit.parse_mutations"), and [`parse_migrations()`](#tskit.parse_migrations "tskit.parse_migrations"),
    respectively. For convenience, if the node table refers to populations,
    but the `populations` parameter is not provided, a minimal set of rows are
    added to the population table, so that a valid tree sequence can be returned.

    The `sequence_length` parameter determines the
    [`TreeSequence.sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") of the returned tree sequence. If it
    is 0 or not specified, the value is taken to be the maximum right
    coordinate of the input edges. This parameter is useful in degenerate
    situations (such as when there are zero edges), but can usually be ignored.

    The `strict` parameter controls the field delimiting algorithm that
    is used. If `strict` is True (the default), we require exactly one
    tab character separating each field. If `strict` is False, a more relaxed
    whitespace delimiting algorithm is used, such that any run of whitespace
    is regarded as a field separator. In most situations, `strict=False`
    is more convenient, but it can lead to error in certain situations. For
    example, if a deletion is encoded in the mutation table this will not
    be parseable when `strict=False`.

    After parsing the tables, [`TableCollection.sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort") is called to ensure that
    the loaded tables satisfy the tree sequence [ordering requirements](data-model.html#sec-valid-tree-sequence-requirements). Note that this may result in the
    IDs of various entities changing from their positions in the input file.

    Parameters:
    :   - **nodes** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing text describing a
          [`NodeTable`](#tskit.NodeTable "tskit.NodeTable").
        - **edges** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing text
          describing an [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable").
        - **sites** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing text describing a
          [`SiteTable`](#tskit.SiteTable "tskit.SiteTable").
        - **mutations** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing text
          describing a [`MutationTable`](#tskit.MutationTable "tskit.MutationTable").
        - **individuals** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing text
          describing a [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable").
        - **populations** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing text
          describing a [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable").
        - **migrations** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing text
          describing a [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable").
        - **sequence\_length** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The sequence length of the returned tree sequence. If
          not supplied or zero this will be inferred from the set of edges.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.

    Returns:
    :   The tree sequence object containing the information
        stored in the specified file paths.

    Return type:
    :   [`tskit.TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence")

tskit.pack\_bytes(*data*)[[source]](_modules/tskit/util.html#pack_bytes)[#](#tskit.pack_bytes "Link to this definition")
:   Packs the specified list of bytes into a flattened numpy array of 8 bit integers
    and corresponding offsets. See [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for details
    of this encoding.

    Parameters:
    :   **data** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*bytes*](https://docs.python.org/3/library/stdtypes.html#bytes "(in Python v3.14)")*]*) – The list of bytes values to encode.

    Returns:
    :   The tuple (packed, offset) of numpy arrays representing the flattened
        input data and offsets.

    Return type:
    :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int8), [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.uint32)

tskit.pack\_strings(*strings*, *encoding='utf8'*)[[source]](_modules/tskit/util.html#pack_strings)[#](#tskit.pack_strings "Link to this definition")
:   Packs the specified list of strings into a flattened numpy array of 8 bit integers
    and corresponding offsets using the specified text encoding.
    See [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for details of this encoding of
    columns of variable length data.

    Parameters:
    :   - **data** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*]*) – The list of strings to encode.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The text encoding to use when converting string data
          to bytes. See the [`codecs`](https://docs.python.org/3/library/codecs.html#module-codecs "(in Python v3.14)") module for information on available
          string encodings.

    Returns:
    :   The tuple (packed, offset) of numpy arrays representing the flattened
        input data and offsets.

    Return type:
    :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int8), [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.uint32)

tskit.parse\_edges(*source*, *strict=True*, *table=None*, *encoding='utf8'*, *base64\_metadata=True*)[[source]](_modules/tskit/trees.html#parse_edges)[#](#tskit.parse_edges "Link to this definition")
:   Parse the specified file-like object containing a whitespace delimited
    description of a edge table and returns the corresponding [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable")
    instance. See the [edge text format](file-formats.html#sec-edge-text-format) section
    for the details of the required format and the
    [edge table definition](data-model.html#sec-edge-table-definition) section for the
    required properties of the contents.

    See [`tskit.load_text()`](#tskit.load_text "tskit.load_text") for a detailed explanation of the `strict` parameter.

    Parameters:
    :   - **source** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing the text.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **table** ([*EdgeTable*](#tskit.EdgeTable "tskit.EdgeTable")) – If specified, write the edges into this table. If
          not, create a new [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") instance and return.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.

tskit.parse\_individuals(*source*, *strict=True*, *encoding='utf8'*, *base64\_metadata=True*, *table=None*)[[source]](_modules/tskit/trees.html#parse_individuals)[#](#tskit.parse_individuals "Link to this definition")
:   Parse the specified file-like object containing a whitespace delimited
    description of an individual table and returns the corresponding
    [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable") instance. See the [individual text format](file-formats.html#sec-individual-text-format) section for the details of the required
    format and the [individual table definition](data-model.html#sec-individual-table-definition) section for the required properties of
    the contents.

    See [`tskit.load_text()`](#tskit.load_text "tskit.load_text") for a detailed explanation of the `strict`
    parameter.

    Parameters:
    :   - **source** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing the text.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.
        - **table** ([*IndividualTable*](#tskit.IndividualTable "tskit.IndividualTable")) – If specified write into this table. If not,
          create a new [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable") instance.

tskit.parse\_mutations(*source*, *strict=True*, *encoding='utf8'*, *base64\_metadata=True*, *table=None*)[[source]](_modules/tskit/trees.html#parse_mutations)[#](#tskit.parse_mutations "Link to this definition")
:   Parse the specified file-like object containing a whitespace delimited
    description of a mutation table and returns the corresponding [`MutationTable`](#tskit.MutationTable "tskit.MutationTable")
    instance. See the [mutation text format](file-formats.html#sec-mutation-text-format) section
    for the details of the required format and the
    [mutation table definition](data-model.html#sec-mutation-table-definition) section for the
    required properties of the contents. Note that if the `time` column is missing its
    entries are filled with `UNKNOWN_TIME`.

    See [`tskit.load_text()`](#tskit.load_text "tskit.load_text") for a detailed explanation of the `strict`
    parameter.

    Parameters:
    :   - **source** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing the text.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.
        - **table** ([*MutationTable*](#tskit.MutationTable "tskit.MutationTable")) – If specified, write mutations into this table.
          If not, create a new [`MutationTable`](#tskit.MutationTable "tskit.MutationTable") instance.

tskit.parse\_nodes(*source*, *strict=True*, *encoding='utf8'*, *base64\_metadata=True*, *table=None*)[[source]](_modules/tskit/trees.html#parse_nodes)[#](#tskit.parse_nodes "Link to this definition")
:   Parse the specified file-like object containing a whitespace delimited
    description of a node table and returns the corresponding [`NodeTable`](#tskit.NodeTable "tskit.NodeTable")
    instance. See the [node text format](file-formats.html#sec-node-text-format) section
    for the details of the required format and the
    [node table definition](data-model.html#sec-node-table-definition) section for the
    required properties of the contents.

    See [`tskit.load_text()`](#tskit.load_text "tskit.load_text") for a detailed explanation of the `strict`
    parameter.

    Parameters:
    :   - **source** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing the text.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.
        - **table** ([*NodeTable*](#tskit.NodeTable "tskit.NodeTable")) – If specified write into this table. If not,
          create a new [`NodeTable`](#tskit.NodeTable "tskit.NodeTable") instance.

tskit.parse\_populations(*source*, *strict=True*, *encoding='utf8'*, *base64\_metadata=True*, *table=None*)[[source]](_modules/tskit/trees.html#parse_populations)[#](#tskit.parse_populations "Link to this definition")
:   Parse the specified file-like object containing a whitespace delimited
    description of a population table and returns the corresponding
    [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable") instance. See the [population text format](file-formats.html#sec-population-text-format) section for the details of the required
    format and the [population table definition](data-model.html#sec-population-table-definition) section for the required properties of
    the contents.

    See [`tskit.load_text()`](#tskit.load_text "tskit.load_text") for a detailed explanation of the `strict`
    parameter.

    Parameters:
    :   - **source** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing the text.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.
        - **table** ([*PopulationTable*](#tskit.PopulationTable "tskit.PopulationTable")) – If specified write into this table. If not,
          create a new [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable") instance.

tskit.parse\_migrations(*source*, *strict=True*, *encoding='utf8'*, *base64\_metadata=True*, *table=None*)[[source]](_modules/tskit/trees.html#parse_migrations)[#](#tskit.parse_migrations "Link to this definition")
:   Parse the specified file-like object containing a whitespace delimited
    description of a migration table and returns the corresponding
    [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable") instance.

    See the [migration text format](file-formats.html#sec-migration-text-format) section
    for the details of the required format and the
    [migration table definition](data-model.html#sec-migration-table-definition) section
    for the required properties of the contents. Note that if the `time` column
    is missing its entries are filled with [`UNKNOWN_TIME`](#tskit.UNKNOWN_TIME "tskit.UNKNOWN_TIME").

    See [`tskit.load_text()`](#tskit.load_text "tskit.load_text") for a detailed explanation of the `strict`
    parameter.

    Parameters:
    :   - **source** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing the text.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.
        - **table** ([*MigrationTable*](#tskit.MigrationTable "tskit.MigrationTable")) – If specified, write migrations into this table.
          If not, create a new [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable") instance.

tskit.parse\_sites(*source*, *strict=True*, *encoding='utf8'*, *base64\_metadata=True*, *table=None*)[[source]](_modules/tskit/trees.html#parse_sites)[#](#tskit.parse_sites "Link to this definition")
:   Parse the specified file-like object containing a whitespace delimited
    description of a site table and returns the corresponding [`SiteTable`](#tskit.SiteTable "tskit.SiteTable")
    instance. See the [site text format](file-formats.html#sec-site-text-format) section
    for the details of the required format and the
    [site table definition](data-model.html#sec-site-table-definition) section for the
    required properties of the contents.

    See [`tskit.load_text()`](#tskit.load_text "tskit.load_text") for a detailed explanation of the `strict`
    parameter.

    Parameters:
    :   - **source** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object containing the text.
        - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, require strict tab delimiting (default). If
          False, a relaxed whitespace splitting algorithm is used.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
        - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, metadata is encoded using Base64
          encoding; otherwise, as plain text.
        - **table** ([*SiteTable*](#tskit.SiteTable "tskit.SiteTable")) – If specified write site into this table. If not,
          create a new [`SiteTable`](#tskit.SiteTable "tskit.SiteTable") instance.

tskit.random\_nucleotides(*length*, *\**, *seed=None*)[[source]](_modules/tskit/util.html#random_nucleotides)[#](#tskit.random_nucleotides "Link to this definition")
:   Returns a random string of nucleotides of the specified length. Characters
    are drawn uniformly from the alphabet “ACTG”.

    Parameters:
    :   **length** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The length of the random sequence.

    Returns:
    :   A string of the specified length consisting of random nucleotide
        characters.

    Return type:
    :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

tskit.register\_metadata\_codec(*codec\_cls*, *codec\_id*)[[source]](_modules/tskit/metadata.html#register_metadata_codec)[#](#tskit.register_metadata_codec "Link to this definition")
:   Register a metadata codec class.
    This function maintains a mapping from metadata codec identifiers used in schemas
    to codec classes. When a codec class is registered, it will replace any class
    previously registered under the same codec identifier, if present.

    Parameters:
    :   **codec\_id** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – String to use to refer to the codec in the schema.

    Return type:
    :   [`None`](https://docs.python.org/3/library/constants.html#None "(in Python v3.14)")

tskit.validate\_provenance(*provenance*)[[source]](_modules/tskit/provenance.html#validate_provenance)[#](#tskit.validate_provenance "Link to this definition")
:   Validates the specified dict-like object against the tskit
    [provenance schema](provenance.html#sec-provenance). If the input does
    not represent a valid instance of the schema an exception is
    raised.

    Parameters:
    :   **provenance** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – The dictionary representing a JSON document
        to be validated against the schema.

    Raises:
    :   [**ProvenanceValidationError**](#tskit.ProvenanceValidationError "tskit.ProvenanceValidationError") – if the schema is not valid.

tskit.unpack\_bytes(*packed*, *offset*)[[source]](_modules/tskit/util.html#unpack_bytes)[#](#tskit.unpack_bytes "Link to this definition")
:   Unpacks a list of bytes from the specified numpy arrays of packed byte
    data and corresponding offsets. See [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for details
    of this encoding.

    Parameters:
    :   - **packed** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – The flattened array of byte values.
        - **offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – The array of offsets into the `packed` array.

    Returns:
    :   The list of bytes values unpacked from the parameter arrays.

    Return type:
    :   [list](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")[[bytes](https://docs.python.org/3/library/stdtypes.html#bytes "(in Python v3.14)")]

tskit.unpack\_strings(*packed*, *offset*, *encoding='utf8'*)[[source]](_modules/tskit/util.html#unpack_strings)[#](#tskit.unpack_strings "Link to this definition")
:   Unpacks a list of strings from the specified numpy arrays of packed byte
    data and corresponding offsets using the specified text encoding.
    See [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for details of this encoding of
    columns of variable length data.

    Parameters:
    :   - **packed** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – The flattened array of byte values.
        - **offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – The array of offsets into the `packed` array.
        - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The text encoding to use when converting string data
          to bytes. See the [`codecs`](https://docs.python.org/3/library/codecs.html#module-codecs "(in Python v3.14)") module for information on available
          string encodings.

    Returns:
    :   The list of strings unpacked from the parameter arrays.

    Return type:
    :   [list](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")[[str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")]

### Tree and tree sequence classes[#](#tree-and-tree-sequence-classes "Link to this heading")

#### The [`Tree`](#tskit.Tree "tskit.Tree") class[#](#the-tree-class "Link to this heading")

Also see the [Tree API](#sec-python-api-trees) summary.

*class* tskit.Tree[[source]](_modules/tskit/trees.html#Tree)[#](#tskit.Tree "Link to this definition")
:   A single tree in a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence"). Please see the
    [Processing trees](https://tskit.dev/tutorials/getting_started.html#sec-processing-trees "(in Project name not set)") section for information
    on how efficiently access trees sequentially or obtain a list
    of individual trees in a tree sequence.

    The `sample_lists` parameter controls the features that are enabled
    for this tree. If `sample_lists` is True a more efficient algorithm is
    used in the [`Tree.samples()`](#tskit.Tree.samples "tskit.Tree.samples") method.

    The `tracked_samples` parameter can be used to efficiently count the
    number of samples in a given set that exist in a particular subtree
    using the [`Tree.num_tracked_samples()`](#tskit.Tree.num_tracked_samples "tskit.Tree.num_tracked_samples") method.

    The [`Tree`](#tskit.Tree "tskit.Tree") class is a state-machine which has a state
    corresponding to each of the trees in the parent tree sequence. We
    transition between these states by using the seek functions like
    [`Tree.first()`](#tskit.Tree.first "tskit.Tree.first"), [`Tree.last()`](#tskit.Tree.last "tskit.Tree.last"), [`Tree.seek()`](#tskit.Tree.seek "tskit.Tree.seek") and
    [`Tree.seek_index()`](#tskit.Tree.seek_index "tskit.Tree.seek_index"). There is one more state, the so-called “null”
    or “cleared” state. This is the state that a [`Tree`](#tskit.Tree "tskit.Tree") is in
    immediately after initialisation; it has an index of -1, and no edges. We
    can also enter the null state by calling [`Tree.next()`](#tskit.Tree.next "tskit.Tree.next") on the last
    tree in a sequence, calling [`Tree.prev()`](#tskit.Tree.prev "tskit.Tree.prev") on the first tree in a
    sequence or calling calling the [`Tree.clear()`](#tskit.Tree.clear "tskit.Tree.clear") method at any time.

    The high-level TreeSequence seeking and iterations methods (e.g,
    [`TreeSequence.trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees")) are built on these low-level state-machine
    seek operations. We recommend these higher level operations for most
    users.

    Parameters:
    :   - **tree\_sequence** ([*TreeSequence*](#tskit.TreeSequence "tskit.TreeSequence")) – The parent tree sequence.
        - **tracked\_samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – The list of samples to be tracked and
          counted using the [`Tree.num_tracked_samples()`](#tskit.Tree.num_tracked_samples "tskit.Tree.num_tracked_samples") method.
        - **sample\_lists** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, provide more efficient access
          to the samples beneath a given node using the
          [`Tree.samples()`](#tskit.Tree.samples "tskit.Tree.samples") method.
        - **root\_threshold** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The minimum number of samples that a node
          must be ancestral to for it to be in the list of roots. By default
          this is 1, so that isolated samples (representing missing data)
          are roots. To efficiently restrict the roots of the tree to
          those subtending meaningful topology, set this to 2. This value
          is only relevant when trees have multiple roots.
        - **sample\_counts** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Deprecated since 0.2.4.

    copy()[[source]](_modules/tskit/trees.html#Tree.copy)[#](#tskit.Tree.copy "Link to this definition")
    :   Returns a deep copy of this tree. The returned tree will have identical state
        to this tree.

        Returns:
        :   A copy of this tree.

        Return type:
        :   [Tree](#tskit.Tree "tskit.Tree")

    *property* tree\_sequence[#](#tskit.Tree.tree_sequence "Link to this definition")
    :   Returns the tree sequence that this tree is from.

        Returns:
        :   The parent tree sequence for this tree.

        Return type:
        :   [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence")

    *property* root\_threshold[#](#tskit.Tree.root_threshold "Link to this definition")
    :   Returns the minimum number of samples that a node must be an ancestor
        of to be considered a potential root. This can be set, for example, when
        calling the [`TreeSequence.trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") iterator.

        Returns:
        :   The root threshold.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    first()[[source]](_modules/tskit/trees.html#Tree.first)[#](#tskit.Tree.first "Link to this definition")
    :   Seeks to the first tree in the sequence. This can be called whether
        the tree is in the null state or not.

    last()[[source]](_modules/tskit/trees.html#Tree.last)[#](#tskit.Tree.last "Link to this definition")
    :   Seeks to the last tree in the sequence. This can be called whether
        the tree is in the null state or not.

    next()[[source]](_modules/tskit/trees.html#Tree.next)[#](#tskit.Tree.next "Link to this definition")
    :   Seeks to the next tree in the sequence. If the tree is in the initial
        null state we seek to the first tree (equivalent to calling [`first()`](#tskit.Tree.first "tskit.Tree.first")).
        Calling `next` on the last tree in the sequence results in the tree
        being cleared back into the null initial state (equivalent to calling
        [`clear()`](#tskit.Tree.clear "tskit.Tree.clear")). The return value of the function indicates whether the
        tree is in a non-null state, and can be used to loop over the trees:

        ```python
        # Iterate over the trees from left-to-right
        tree = tskit.Tree(tree_sequence)
        while tree.next()
            # Do something with the tree.
            print(tree.index)
        # tree is now back in the null state.
        ```

        Returns:
        :   True if the tree has been transformed into one of the trees
            in the sequence; False if the tree has been transformed into the
            null state.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    prev()[[source]](_modules/tskit/trees.html#Tree.prev)[#](#tskit.Tree.prev "Link to this definition")
    :   Seeks to the previous tree in the sequence. If the tree is in the initial
        null state we seek to the last tree (equivalent to calling [`last()`](#tskit.Tree.last "tskit.Tree.last")).
        Calling `prev` on the first tree in the sequence results in the tree
        being cleared back into the null initial state (equivalent to calling
        [`clear()`](#tskit.Tree.clear "tskit.Tree.clear")). The return value of the function indicates whether the
        tree is in a non-null state, and can be used to loop over the trees:

        ```python
        # Iterate over the trees from right-to-left
        tree = tskit.Tree(tree_sequence)
        while tree.prev()
            # Do something with the tree.
            print(tree.index)
        # tree is now back in the null state.
        ```

        Returns:
        :   True if the tree has been transformed into one of the trees
            in the sequence; False if the tree has been transformed into the
            null state.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    clear()[[source]](_modules/tskit/trees.html#Tree.clear)[#](#tskit.Tree.clear "Link to this definition")
    :   Resets this tree back to the initial null state. Calling this method
        on a tree already in the null state has no effect.

    seek\_index(*index*, *skip=None*)[[source]](_modules/tskit/trees.html#Tree.seek_index)[#](#tskit.Tree.seek_index "Link to this definition")
    :   Sets the state to represent the tree at the specified
        index in the parent tree sequence. Negative indexes following the
        standard Python conventions are allowed, i.e., `index=-1` will
        seek to the last tree in the sequence.

        Warning

        The current implementation of this operation is linear in the number of
        trees, so may be inefficient for large tree sequences. See
        [this issue](https://github.com/tskit-dev/tskit/issues/684) for more
        information.

        Parameters:
        :   **index** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The tree index to seek to.

        Raises:
        :   [**IndexError**](https://docs.python.org/3/library/exceptions.html#IndexError "(in Python v3.14)") – If an index outside the acceptable range is provided.

    seek(*position*, *skip=None*)[[source]](_modules/tskit/trees.html#Tree.seek)[#](#tskit.Tree.seek "Link to this definition")
    :   Sets the state to represent the tree that covers the specified
        position in the parent tree sequence. After a successful return
        of this method we have `tree.interval.left` <= `position`
        < `tree.interval.right`.

        Warning

        The current implementation of this operation is linear in the number of
        trees, so may be inefficient for large tree sequences. See
        [this issue](https://github.com/tskit-dev/tskit/issues/684) for more
        information.

        Parameters:
        :   **position** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The position along the sequence length to
            seek to.

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If `position` is less than 0 or `position` is greater
            than or equal to
            [`TreeSequence.sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length").

    rank()[[source]](_modules/tskit/trees.html#Tree.rank)[#](#tskit.Tree.rank "Link to this definition")
    :   Produce the rank of this tree in the enumeration of all leaf-labelled
        trees of n leaves. See the [Interpreting Tree Ranks](topological-analysis.html#sec-tree-ranks) section for
        details on ranking and unranking trees.

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If the tree has multiple roots.

        Return type:
        :   [`Rank`](#tskit.Rank "tskit.combinatorics.Rank")

    *static* unrank(*num\_leaves*, *rank*, *\**, *span=1*, *branch\_length=1*)[[source]](_modules/tskit/trees.html#Tree.unrank)[#](#tskit.Tree.unrank "Link to this definition")
    :   Reconstruct the tree of the given `rank`
        (see [`tskit.Tree.rank()`](#tskit.Tree.rank "tskit.Tree.rank")) with `num_leaves` leaves.
        The labels and times of internal nodes are assigned by a postorder
        traversal of the nodes, such that the time of each internal node
        is the maximum time of its children plus the specified `branch_length`.
        The time of each leaf is 0.

        See the [Interpreting Tree Ranks](topological-analysis.html#sec-tree-ranks) section for details on ranking and
        unranking trees and what constitutes valid ranks.

        Parameters:
        :   - **num\_leaves** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of leaves of the tree to generate.
            - **rank** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*)*) – The rank of the tree to generate.
            - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The genomic span of the returned tree. The tree will cover
              the interval \([0, \text{span})\) and the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence")
              from which the tree is taken will have its
              [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") equal to `span`.
            - **branch\_length** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The minimum length of a branch in this tree.

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If the given rank is out of bounds for trees
            with `num_leaves` leaves.

        Return type:
        :   [`Tree`](#tskit.Tree "tskit.trees.Tree")

    count\_topologies(*sample\_sets=None*)[[source]](_modules/tskit/trees.html#Tree.count_topologies)[#](#tskit.Tree.count_topologies "Link to this definition")
    :   Calculates the distribution of embedded topologies for every combination
        of the sample sets in `sample_sets`. `sample_sets` defaults to all
        samples in the tree grouped by population.

        `sample_sets` need not include all samples but must be pairwise disjoint.

        The returned object is a [`tskit.TopologyCounter`](#tskit.TopologyCounter "tskit.TopologyCounter") that contains
        counts of topologies per combination of sample sets. For example:

        ```python
        topology_counter = tree.count_topologies()
        rank, count = topology_counter[0, 1, 2].most_common(1)[0]
        ```

        produces the most common tree topology, with populations 0, 1
        and 2 as its tips, according to the genealogies of those
        populations’ samples in this tree.

        The counts for each topology in the [`tskit.TopologyCounter`](#tskit.TopologyCounter "tskit.TopologyCounter")
        are absolute counts that we would get if we were to select all
        combinations of samples from the relevant sample sets.
        For sample sets \([s\_0, s\_1, ..., s\_n]\), the total number of
        topologies for those sample sets is equal to
        \(|s\_0| \* |s\_1| \* ... \* |s\_n|\), so the counts in the counter
        `topology_counter[0, 1, ..., n]` should sum to
        \(|s\_0| \* |s\_1| \* ... \* |s\_n|\).

        To convert the topology counts to probabilities, divide by the total
        possible number of sample combinations from the sample sets in question:

        ```python
        set_sizes = [len(sample_set) for sample_set in sample_sets]
        p = count / (set_sizes[0] * set_sizes[1] * set_sizes[2])
        ```

        Warning

        The interface for this method is preliminary and may be subject to
        backwards incompatible changes in the near future.

        Parameters:
        :   **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
            groups of nodes to compute the statistic with.
            Defaults to all samples grouped by population.

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If nodes in `sample_sets` are invalid or are
            internal samples.

        Return type:
        :   [`TopologyCounter`](#tskit.TopologyCounter "tskit.combinatorics.TopologyCounter")

    branch\_length(*u*)[[source]](_modules/tskit/trees.html#Tree.branch_length)[#](#tskit.Tree.branch_length "Link to this definition")
    :   Returns the length of the branch (in units of time) joining the
        specified node to its parent. This is equivalent to:

        ```python
        tree.time(tree.parent(u)) - tree.time(u)
        ```

        The branch length for a node that has no parent (e.g., a root) is
        defined as zero.

        Note that this is not related to the property .length which
        is a deprecated alias for the genomic [`span`](#tskit.Tree.span "tskit.Tree.span") covered by a tree.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The branch length from u to its parent.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    *property* total\_branch\_length[#](#tskit.Tree.total_branch_length "Link to this definition")
    :   Returns the sum of all the branch lengths in this tree (in
        units of time). This is equivalent to:

        ```python
        sum(tree.branch_length(u) for u in tree.nodes())
        ```

        Note that the branch lengths for root nodes are defined as zero.

        As this is defined by a traversal of the tree, technically we
        return the sum of all branch lengths that are reachable from
        roots. Thus, this is the total length of all branches that are connected
        to at least one sample. This distinction is only important
        in tree sequences that contain ‘dead branches’, i.e., those
        that define topology that is not connected to a tree root
        (see [Dead leaves and branches](data-model.html#sec-data-model-tree-dead-leaves-and-branches))

        Returns:
        :   The sum of lengths of branches in this tree.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    mrca(*\*args*)[[source]](_modules/tskit/trees.html#Tree.mrca)[#](#tskit.Tree.mrca "Link to this definition")
    :   Returns the most recent common ancestor of the specified nodes.

        Parameters:
        :   **\*args** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – input node IDs, at least 2 arguments are required.

        Returns:
        :   The node ID of the most recent common ancestor of the
            input nodes, or [`tskit.NULL`](#tskit.NULL "tskit.NULL") if the nodes do not share
            a common ancestor in the tree.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    tmrca(*\*args*)[[source]](_modules/tskit/trees.html#Tree.tmrca)[#](#tskit.Tree.tmrca "Link to this definition")
    :   Returns the time of the most recent common ancestor of the specified
        nodes. This is equivalent to:

        ```python
        tree.time(tree.mrca(*args))
        ```

        Note

        If you are using this method to calculate average tmrca values along the
        genome between pairs of sample nodes, for efficiency reasons you should
        instead consider the `mode="branch"` option of the
        [`TreeSequence.divergence()`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence") or [`TreeSequence.diversity()`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity") methods.
        Since these calculate the average branch length between pairs of sample
        nodes, for samples at time 0 the resulting statistics will be exactly
        twice the tmrca value.

        Parameters:
        :   **\*args** – input node IDs, at least 2 arguments are required.

        Returns:
        :   The time of the most recent common ancestor of all the nodes.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If the nodes do not share a single common ancestor in this
            tree (i.e., if `tree.mrca(*args) == tskit.NULL`)

    parent(*u*)[[source]](_modules/tskit/trees.html#Tree.parent)[#](#tskit.Tree.parent "Link to this definition")
    :   Returns the parent of the specified node. Returns
        [`tskit.NULL`](#tskit.NULL "tskit.NULL") if u is a root or is not a node in
        the current tree.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The parent of u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* parent\_array[#](#tskit.Tree.parent_array "Link to this definition")
    :   A numpy array (dtype=np.int32) encoding the parent of each node
        in this tree, such that `tree.parent_array[u] == tree.parent(u)`
        for all `0 <= u <= ts.num_nodes`. See the [`parent()`](#tskit.Tree.parent "tskit.Tree.parent")
        method for details on the semantics of tree parents and the
        [Tree structure](data-model.html#sec-data-model-tree-structure) section for information on the
        quintuply linked tree encoding.

        Note

        The length of these arrays is
        equal to the number of nodes in the tree sequence plus 1, with the
        final element corresponding to the tree’s [`virtual_root()`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root").
        Please see the [tree roots](data-model.html#sec-data-model-tree-roots) section
        for more details.

        Warning

        This is a high-performance interface which
        provides zero-copy access to memory used in the C library.
        As a consequence, the values stored in this array will change as
        the Tree state is modified as we move along the tree sequence. See the
        [`Tree`](#tskit.Tree "tskit.Tree") documentation for more details. Therefore, if you want to
        compare arrays representing different trees along the sequence, you must
        take **copies** of the arrays.

    ancestors(*u*)[[source]](_modules/tskit/trees.html#Tree.ancestors)[#](#tskit.Tree.ancestors "Link to this definition")
    :   Returns an iterator over the ancestors of node `u` in this tree
        (i.e. the chain of parents from `u` to the root).

    left\_child(*u*)[[source]](_modules/tskit/trees.html#Tree.left_child)[#](#tskit.Tree.left_child "Link to this definition")
    :   Returns the leftmost child of the specified node. Returns
        [`tskit.NULL`](#tskit.NULL "tskit.NULL") if u is a leaf or is not a node in
        the current tree. The left-to-right ordering of children
        is arbitrary and should not be depended on; see the
        [data model](data-model.html#sec-data-model-tree-structure) section
        for details.

        This is a low-level method giving access to the quintuply linked
        tree structure in memory; the [`children()`](#tskit.Tree.children "tskit.Tree.children") method is a more
        convenient way to obtain the children of a given node.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The leftmost child of u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* left\_child\_array[#](#tskit.Tree.left_child_array "Link to this definition")
    :   A numpy array (dtype=np.int32) encoding the left child of each node
        in this tree, such that `tree.left_child_array[u] == tree.left_child(u)`
        for all `0 <= u <= ts.num_nodes`. See the [`left_child()`](#tskit.Tree.left_child "tskit.Tree.left_child")
        method for details on the semantics of tree left\_child and the
        [Tree structure](data-model.html#sec-data-model-tree-structure) section for information on the
        quintuply linked tree encoding.

        Note

        The length of these arrays is
        equal to the number of nodes in the tree sequence plus 1, with the
        final element corresponding to the tree’s [`virtual_root()`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root").
        Please see the [tree roots](data-model.html#sec-data-model-tree-roots) section
        for more details.

        Warning

        This is a high-performance interface which
        provides zero-copy access to memory used in the C library.
        As a consequence, the values stored in this array will change as
        the Tree state is modified as we move along the tree sequence. See the
        [`Tree`](#tskit.Tree "tskit.Tree") documentation for more details. Therefore, if you want to
        compare arrays representing different trees along the sequence, you must
        take **copies** of the arrays.

    right\_child(*u*)[[source]](_modules/tskit/trees.html#Tree.right_child)[#](#tskit.Tree.right_child "Link to this definition")
    :   Returns the rightmost child of the specified node. Returns
        [`tskit.NULL`](#tskit.NULL "tskit.NULL") if u is a leaf or is not a node in
        the current tree. The left-to-right ordering of children
        is arbitrary and should not be depended on; see the
        [data model](data-model.html#sec-data-model-tree-structure) section
        for details.

        This is a low-level method giving access to the quintuply linked
        tree structure in memory; the [`children()`](#tskit.Tree.children "tskit.Tree.children") method is a more
        convenient way to obtain the children of a given node.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The rightmost child of u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* right\_child\_array[#](#tskit.Tree.right_child_array "Link to this definition")
    :   A numpy array (dtype=np.int32) encoding the right child of each node
        in this tree, such that `tree.right_child_array[u] == tree.right_child(u)`
        for all `0 <= u <= ts.num_nodes`. See the [`right_child()`](#tskit.Tree.right_child "tskit.Tree.right_child")
        method for details on the semantics of tree right\_child and the
        [Tree structure](data-model.html#sec-data-model-tree-structure) section for information on the
        quintuply linked tree encoding.

        Note

        The length of these arrays is
        equal to the number of nodes in the tree sequence plus 1, with the
        final element corresponding to the tree’s [`virtual_root()`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root").
        Please see the [tree roots](data-model.html#sec-data-model-tree-roots) section
        for more details.

        Warning

        This is a high-performance interface which
        provides zero-copy access to memory used in the C library.
        As a consequence, the values stored in this array will change as
        the Tree state is modified as we move along the tree sequence. See the
        [`Tree`](#tskit.Tree "tskit.Tree") documentation for more details. Therefore, if you want to
        compare arrays representing different trees along the sequence, you must
        take **copies** of the arrays.

    left\_sib(*u*)[[source]](_modules/tskit/trees.html#Tree.left_sib)[#](#tskit.Tree.left_sib "Link to this definition")
    :   Returns the sibling node to the left of u, or [`tskit.NULL`](#tskit.NULL "tskit.NULL")
        if u does not have a left sibling.
        The left-to-right ordering of children
        is arbitrary and should not be depended on; see the
        [data model](data-model.html#sec-data-model-tree-structure) section
        for details.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The sibling node to the left of u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* left\_sib\_array[#](#tskit.Tree.left_sib_array "Link to this definition")
    :   A numpy array (dtype=np.int32) encoding the left sib of each node
        in this tree, such that `tree.left_sib_array[u] == tree.left_sib(u)`
        for all `0 <= u <= ts.num_nodes`. See the [`left_sib()`](#tskit.Tree.left_sib "tskit.Tree.left_sib")
        method for details on the semantics of tree left\_sib and the
        [Tree structure](data-model.html#sec-data-model-tree-structure) section for information on the
        quintuply linked tree encoding.

        Note

        The length of these arrays is
        equal to the number of nodes in the tree sequence plus 1, with the
        final element corresponding to the tree’s [`virtual_root()`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root").
        Please see the [tree roots](data-model.html#sec-data-model-tree-roots) section
        for more details.

        Warning

        This is a high-performance interface which
        provides zero-copy access to memory used in the C library.
        As a consequence, the values stored in this array will change as
        the Tree state is modified as we move along the tree sequence. See the
        [`Tree`](#tskit.Tree "tskit.Tree") documentation for more details. Therefore, if you want to
        compare arrays representing different trees along the sequence, you must
        take **copies** of the arrays.

    right\_sib(*u*)[[source]](_modules/tskit/trees.html#Tree.right_sib)[#](#tskit.Tree.right_sib "Link to this definition")
    :   Returns the sibling node to the right of u, or [`tskit.NULL`](#tskit.NULL "tskit.NULL")
        if u does not have a right sibling.
        The left-to-right ordering of children
        is arbitrary and should not be depended on; see the
        [data model](data-model.html#sec-data-model-tree-structure) section
        for details.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The sibling node to the right of u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* right\_sib\_array[#](#tskit.Tree.right_sib_array "Link to this definition")
    :   A numpy array (dtype=np.int32) encoding the right sib of each node
        in this tree, such that `tree.right_sib_array[u] == tree.right_sib(u)`
        for all `0 <= u <= ts.num_nodes`. See the [`right_sib()`](#tskit.Tree.right_sib "tskit.Tree.right_sib")
        method for details on the semantics of tree right\_sib and the
        [Tree structure](data-model.html#sec-data-model-tree-structure) section for information on the
        quintuply linked tree encoding.

        Note

        The length of these arrays is
        equal to the number of nodes in the tree sequence plus 1, with the
        final element corresponding to the tree’s [`virtual_root()`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root").
        Please see the [tree roots](data-model.html#sec-data-model-tree-roots) section
        for more details.

        Warning

        This is a high-performance interface which
        provides zero-copy access to memory used in the C library.
        As a consequence, the values stored in this array will change as
        the Tree state is modified as we move along the tree sequence. See the
        [`Tree`](#tskit.Tree "tskit.Tree") documentation for more details. Therefore, if you want to
        compare arrays representing different trees along the sequence, you must
        take **copies** of the arrays.

    siblings(*u*)[[source]](_modules/tskit/trees.html#Tree.siblings)[#](#tskit.Tree.siblings "Link to this definition")
    :   Returns the sibling(s) of the specified node `u` as a tuple of integer
        node IDs. If `u` has no siblings or is not a node in the current tree,
        returns an empty tuple. If `u` is the root of a single-root tree,
        returns an empty tuple; if `u` is the root of a multi-root tree,
        returns the other roots (note all the roots are related by the virtual root).
        If `u` is the virtual root (which has no siblings), returns an empty tuple.
        If `u` is an isolated node, whether it has siblings or not depends on
        whether it is a sample or non-sample node; if it is a sample node,
        returns the root(s) of the tree, otherwise, returns an empty tuple.
        The ordering of siblings is arbitrary and should not be depended on;
        see the [data model](data-model.html#sec-data-model-tree-structure) section for details.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The siblings of `u`.

        Return type:
        :   [tuple](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")([int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)"))

    *property* num\_children\_array[#](#tskit.Tree.num_children_array "Link to this definition")
    :   A numpy array (dtype=np.int32) encoding the number of children of
        each node in this tree, such that
        `tree.num_children_array[u] == tree.num_children(u)` for all
        `0 <= u <= ts.num_nodes`. See the [`num_children()`](#tskit.Tree.num_children "tskit.Tree.num_children")
        method for details on the semantics of tree num\_children and the
        [Tree structure](data-model.html#sec-data-model-tree-structure) section for information on the
        quintuply linked tree encoding.

        Note

        The length of these arrays is
        equal to the number of nodes in the tree sequence plus 1, with the
        final element corresponding to the tree’s [`virtual_root()`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root").
        Please see the [tree roots](data-model.html#sec-data-model-tree-roots) section
        for more details.

        Warning

        This is a high-performance interface which
        provides zero-copy access to memory used in the C library.
        As a consequence, the values stored in this array will change as
        the Tree state is modified as we move along the tree sequence. See the
        [`Tree`](#tskit.Tree "tskit.Tree") documentation for more details. Therefore, if you want to
        compare arrays representing different trees along the sequence, you must
        take **copies** of the arrays.

    edge(*u*)[[source]](_modules/tskit/trees.html#Tree.edge)[#](#tskit.Tree.edge "Link to this definition")
    :   Returns the id of the edge encoding the relationship between `u`
        and its parent, or [`tskit.NULL`](#tskit.NULL "tskit.NULL") if `u` is a root, virtual root
        or is not a node in the current tree.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   Id of edge connecting u to its parent.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* edge\_array[#](#tskit.Tree.edge_array "Link to this definition")
    :   A numpy array (dtype=np.int32) of edge ids encoding the relationship
        between the child node `u` and its parent, such that
        `tree.edge_array[u] == tree.edge(u)` for all
        `0 <= u <= ts.num_nodes`. See the [`edge()`](#tskit.Tree.edge "tskit.Tree.edge")
        method for details on the semantics of tree edge and the
        [Tree structure](data-model.html#sec-data-model-tree-structure) section for information on the
        quintuply linked tree encoding.

        Note

        The length of these arrays is
        equal to the number of nodes in the tree sequence plus 1, with the
        final element corresponding to the tree’s [`virtual_root()`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root").
        Please see the [tree roots](data-model.html#sec-data-model-tree-roots) section
        for more details.

        Warning

        This is a high-performance interface which
        provides zero-copy access to memory used in the C library.
        As a consequence, the values stored in this array will change as
        the Tree state is modified as we move along the tree sequence. See the
        [`Tree`](#tskit.Tree "tskit.Tree") documentation for more details. Therefore, if you want to
        compare arrays representing different trees along the sequence, you must
        take **copies** of the arrays.

    *property* virtual\_root[#](#tskit.Tree.virtual_root "Link to this definition")
    :   The ID of the virtual root in this tree. This is equal to
        [`TreeSequence.num_nodes`](#tskit.TreeSequence.num_nodes "tskit.TreeSequence.num_nodes").

        Please see the [tree roots](data-model.html#sec-data-model-tree-roots)
        section for more details.

    *property* num\_edges[#](#tskit.Tree.num_edges "Link to this definition")
    :   The total number of edges in this tree. This is equal to the
        number of tree sequence edges that intersect with this tree’s
        genomic interval.

        Note that this may be greater than the number of branches that
        are reachable from the tree’s roots, since we can have topology
        that is not associated with any samples.

    *property* left\_root[#](#tskit.Tree.left_root "Link to this definition")
    :   The leftmost root in this tree. If there are multiple roots
        in this tree, they are siblings of this node, and so we can
        use [`right_sib()`](#tskit.Tree.right_sib "tskit.Tree.right_sib") to iterate over all roots:

        ```python
        u = tree.left_root
        while u != tskit.NULL:
            print("Root:", u)
            u = tree.right_sib(u)
        ```

        The left-to-right ordering of roots is arbitrary and should
        not be depended on; see the
        [data model](data-model.html#sec-data-model-tree-structure)
        section for details.

        This is a low-level method giving access to the quintuply linked
        tree structure in memory; the [`roots`](#tskit.Tree.roots "tskit.Tree.roots") attribute is a more
        convenient way to obtain the roots of a tree. If you are assuming
        that there is a single root in the tree you should use the
        [`root`](#tskit.Tree.root "tskit.Tree.root") property.

        Warning

        Do not use this property if you are assuming that there
        is a single root in trees that are being processed. The
        [`root`](#tskit.Tree.root "tskit.Tree.root") property should be used in this case, as it will
        raise an error when multiple roots exists.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    children(*u*)[[source]](_modules/tskit/trees.html#Tree.children)[#](#tskit.Tree.children "Link to this definition")
    :   Returns the children of the specified node `u` as a tuple of integer node IDs.
        If `u` is a leaf, return the empty tuple. The ordering of children
        is arbitrary and should not be depended on; see the
        [data model](data-model.html#sec-data-model-tree-structure) section
        for details.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The children of `u` as a tuple of integers

        Return type:
        :   [tuple](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")([int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)"))

    time(*u*)[[source]](_modules/tskit/trees.html#Tree.time)[#](#tskit.Tree.time "Link to this definition")
    :   Returns the time of the specified node. This is equivalently
        to `tree.tree_sequence.node(u).time` except for the special
        case of the tree’s [virtual root](data-model.html#sec-data-model-tree-roots),
        which is defined as positive infinity.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The time of u.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    depth(*u*)[[source]](_modules/tskit/trees.html#Tree.depth)[#](#tskit.Tree.depth "Link to this definition")
    :   Returns the number of nodes on the path from `u` to a
        root, not including `u`. Thus, the depth of a root is
        zero.

        As a special case, the depth of the [virtual root](data-model.html#sec-data-model-tree-roots) is defined as -1.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The depth of u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    population(*u*)[[source]](_modules/tskit/trees.html#Tree.population)[#](#tskit.Tree.population "Link to this definition")
    :   Returns the population associated with the specified node.
        Equivalent to `tree.tree_sequence.node(u).population`.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The ID of the population associated with node u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    is\_internal(*u*)[[source]](_modules/tskit/trees.html#Tree.is_internal)[#](#tskit.Tree.is_internal "Link to this definition")
    :   Returns True if the specified node is not a leaf. A node is internal
        if it has one or more children in the current tree.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   True if u is not a leaf node.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    is\_leaf(*u*)[[source]](_modules/tskit/trees.html#Tree.is_leaf)[#](#tskit.Tree.is_leaf "Link to this definition")
    :   Returns True if the specified node is a leaf. A node \(u\) is a
        leaf if it has zero children.

        Note

        \(u\) can be any node in the entire tree sequence, including ones
        which are not connected via branches to a root node of the tree (and which
        are therefore not conventionally considered part of the tree). Indeed, if
        there are many trees in the tree sequence, it is common for the majority of
        non-sample nodes to be [`isolated`](#tskit.Tree.is_isolated "tskit.Tree.is_isolated") in any one
        tree. By the definition above, this method will return `True` for such
        a tree when a node of this sort is specified. Such nodes can be thought of
        as “dead leaves”, see [Dead leaves and branches](data-model.html#sec-data-model-tree-dead-leaves-and-branches).

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   True if u is a leaf node.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    is\_isolated(*u*)[[source]](_modules/tskit/trees.html#Tree.is_isolated)[#](#tskit.Tree.is_isolated "Link to this definition")
    :   Returns True if the specified node is isolated in this tree: that is
        it has no parents and no children (note that all isolated nodes in the tree
        are therefore also [`leaves`](#tskit.Tree.is_leaf "tskit.Tree.is_leaf")). Sample nodes that are isolated
        and have no mutations above them are used to represent
        [missing data](data-model.html#sec-data-model-missing-data).

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   True if u is an isolated node.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    is\_sample(*u*)[[source]](_modules/tskit/trees.html#Tree.is_sample)[#](#tskit.Tree.is_sample "Link to this definition")
    :   Returns True if the specified node is a sample. A node \(u\) is a
        sample if it has been marked as a sample in the parent tree sequence.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   True if u is a sample.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    is\_descendant(*u*, *v*)[[source]](_modules/tskit/trees.html#Tree.is_descendant)[#](#tskit.Tree.is_descendant "Link to this definition")
    :   Returns True if the specified node u is a descendant of node v and False
        otherwise. A node \(u\) is a descendant of another node \(v\) if
        \(v\) is on the path from \(u\) to root. A node is considered
        to be a descendant of itself, so `tree.is_descendant(u, u)` will be
        True for any valid node.

        Parameters:
        :   - **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The descendant node.
            - **v** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ancestral node.

        Returns:
        :   True if u is a descendant of v.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If u or v are not valid node IDs.

    *property* num\_nodes[#](#tskit.Tree.num_nodes "Link to this definition")
    :   Returns the number of nodes in the [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") this tree is in.
        Equivalent to `tree.tree_sequence.num_nodes`.

        Deprecated since version 0.4: Use [`Tree.tree_sequence.num_nodes`](#tskit.TreeSequence.num_nodes "tskit.TreeSequence.num_nodes") if you want
        the number of nodes in the entire tree sequence, or
        `len(tree.preorder())` to find the number of nodes that are
        reachable from all roots in this tree.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_roots[#](#tskit.Tree.num_roots "Link to this definition")
    :   The number of roots in this tree, as defined in the [`roots`](#tskit.Tree.roots "tskit.Tree.roots")
        attribute.

        Only requires O(number of roots) time.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* has\_single\_root[#](#tskit.Tree.has_single_root "Link to this definition")
    :   `True` if this tree has a single root, `False` otherwise.
        Equivalent to tree.num\_roots == 1. This is a O(1) operation.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    *property* has\_multiple\_roots[#](#tskit.Tree.has_multiple_roots "Link to this definition")
    :   `True` if this tree has more than one root, `False` otherwise.
        Equivalent to tree.num\_roots > 1. This is a O(1) operation.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    *property* roots[#](#tskit.Tree.roots "Link to this definition")
    :   The list of roots in this tree. A root is defined as a unique endpoint of the
        paths starting at samples, subject to the condition that it is connected to at
        least [`root_threshold`](#tskit.Tree.root_threshold "tskit.Tree.root_threshold") samples. We can define the set of roots as follows:

        ```python
        roots = set()
        for u in tree_sequence.samples():
            while tree.parent(u) != tskit.NULL:
                u = tree.parent(u)
            if tree.num_samples(u) >= tree.root_threshold:
                roots.add(u)
        # roots is now the set of all roots in this tree.
        assert sorted(roots) == sorted(tree.roots)
        ```

        The roots of the tree are returned in a list, in no particular order.

        Only requires O(number of roots) time.

        Note

        In trees with large amounts of [Missing data](data-model.html#sec-data-model-missing-data),
        for example where a region of the genome lacks any ancestral information,
        there can be a very large number of roots, potentially all the samples
        in the tree sequence.

        Returns:
        :   The list of roots in this tree.

        Return type:
        :   [list](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")

    *property* root[#](#tskit.Tree.root "Link to this definition")
    :   The root of this tree. If the tree contains multiple roots, a ValueError is
        raised indicating that the [`roots`](#tskit.Tree.roots "tskit.Tree.roots") attribute should be used instead.

        Returns:
        :   The root node.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – if this tree contains more than one root.

    is\_root(*u*)[[source]](_modules/tskit/trees.html#Tree.is_root)[#](#tskit.Tree.is_root "Link to this definition")
    :   Returns `True` if the specified node is a root in this tree (see
        [`roots`](#tskit.Tree.roots "tskit.Tree.roots") for the definition of a root). This is exactly equivalent to
        finding the node ID in [`roots`](#tskit.Tree.roots "tskit.Tree.roots"), but is more efficient for trees
        with large numbers of roots, such as in regions with extensive
        [Missing data](data-model.html#sec-data-model-missing-data). Note that `False` is returned for all
        other nodes, including [isolated](data-model.html#sec-data-model-tree-isolated-nodes)
        non-sample nodes which are not found in the topology of the current tree.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Return type:
        :   [`bool`](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

        Returns:
        :   `True` if u is a root.

    *property* index[#](#tskit.Tree.index "Link to this definition")
    :   Returns the index this tree occupies in the parent tree sequence.
        This index is zero based, so the first tree in the sequence has index 0.

        Returns:
        :   The index of this tree.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* interval[#](#tskit.Tree.interval "Link to this definition")
    :   Returns the coordinates of the genomic interval that this tree
        represents the history of. The interval is returned as a tuple
        \((l, r)\) and is a half-open interval such that the left
        coordinate is inclusive and the right coordinate is exclusive. This
        tree therefore applies to all genomic locations \(x\) such that
        \(l \leq x < r\).

        Returns:
        :   A named tuple (l, r) representing the left-most (inclusive)
            and right-most (exclusive) coordinates of the genomic region
            covered by this tree. The coordinates can be accessed by index
            (`0` or `1`) or equivalently by name (`.left` or `.right`)

        Return type:
        :   [Interval](#tskit.Interval "tskit.Interval")

    *property* span[#](#tskit.Tree.span "Link to this definition")
    :   Returns the genomic distance that this tree spans.
        This is defined as \(r - l\), where \((l, r)\) is the genomic
        interval returned by [`interval`](#tskit.Tree.interval "tskit.Tree.interval").

        Returns:
        :   The genomic distance covered by this tree.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    *property* mid[#](#tskit.Tree.mid "Link to this definition")
    :   Returns the midpoint of the genomic interval that this tree represents
        the history of. This is defined as \((l + (r - l) / 2)\), where
        \((l, r)\) is the genomic interval returned by
        [`interval`](#tskit.Tree.interval "tskit.Tree.interval").

        Returns:
        :   The genomic distance covered by this tree.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    draw\_text(*orientation=None*, *\**, *node\_labels=None*, *max\_time=None*, *use\_ascii=False*, *order=None*)[[source]](_modules/tskit/trees.html#Tree.draw_text)[#](#tskit.Tree.draw_text "Link to this definition")
    :   Create a text representation of a tree.

        Parameters:
        :   - **orientation** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – one of `"top"`, `"left"`, `"bottom"`, or
              `"right"`, specifying the margin on which the root is placed. Specifying
              `"left"` or `"right"` will lead to time being shown on the x axis (i.e.
              a “horizontal” tree. If `None` (default) use the standard coalescent
              arrangement of a vertical tree with recent nodes at the bottom of the plot
              and older nodes above.
            - **node\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom labels for the nodes
              that are present in the map. Any nodes not specified in the map will
              not have a node label.
            - **max\_time** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – If equal to `"tree"` (the default), the maximum time
              is set to be that of the oldest root in the tree. If equal to `"ts"` the
              maximum time is set to be the time of the oldest root in the tree
              sequence; this is useful when drawing trees from the same tree sequence as it
              ensures that node heights are consistent.
            - **use\_ascii** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `False` (default) then use unicode
              [box drawing characters](https://en.wikipedia.org/wiki/Box-drawing_character)
              to render the tree. If `True`, use plain ascii characters, which look
              cruder but are less susceptible to misalignment or font substitution.
              Alternatively, if you are having alignment problems with Unicode, you can try
              out the solution documented [here](https://github.com/tskit-dev/tskit/issues/189#issuecomment-499114811).
            - **order** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The left-to-right ordering of child nodes in the drawn tree.
              This can be either: `"minlex"`, which minimises the differences
              between adjacent trees (see also the `"minlex_postorder"` traversal
              order for the [`nodes()`](#tskit.Tree.nodes "tskit.Tree.nodes") method); or `"tree"` which draws trees
              in the left-to-right order defined by the
              [quintuply linked tree structure](data-model.html#sec-data-model-tree-structure).
              If not specified or None, this defaults to `"minlex"`.

        Returns:
        :   A text representation of a tree.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    draw\_svg(*path=None*, *\**, *size=None*, *time\_scale=None*, *tree\_height\_scale=None*, *title=None*, *max\_time=None*, *min\_time=None*, *max\_tree\_height=None*, *node\_labels=None*, *mutation\_labels=None*, *node\_titles=None*, *mutation\_titles=None*, *root\_svg\_attributes=None*, *style=None*, *order=None*, *force\_root\_branch=None*, *symbol\_size=None*, *x\_axis=None*, *x\_label=None*, *x\_regions=None*, *y\_axis=None*, *y\_label=None*, *y\_ticks=None*, *y\_gridlines=None*, *all\_edge\_mutations=None*, *omit\_sites=None*, *canvas\_size=None*, *preamble=None*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#Tree.draw_svg)[#](#tskit.Tree.draw_svg "Link to this definition")
    :   Return an SVG representation of a single tree. By default, numeric
        labels are drawn beside nodes and mutations: these can be altered using the
        `node_labels` and `mutation_labels` parameters. See the
        [visualization tutorial](https://tskit.dev/tutorials/viz.html#sec-tskit-viz "(in Project name not set)") for more details.

        Parameters:
        :   - **path** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The path to the file to write the output. If None, do not
              write to file.
            - **size** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*)*) – A tuple of (width, height) specifying a target
              drawing size in abstract user units (usually interpreted as pixels on
              initial display). Components of the drawing will be scaled so that the total
              plot including labels etc. normally fits onto a canvas of this size (see
              `canvas_size` below). If `None`, pick a size appropriate for a tree
              with a reasonably small number (i.e. tens) of samples. Default: `None`
            - **time\_scale** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Control how height values for nodes are computed.
              If this is equal to `"time"` (the default), node heights are proportional
              to their time values. If this is equal to `"log_time"`, node heights are
              proportional to their log(time) values. If it is equal to `"rank"`, node
              heights are spaced equally according to their ranked times.
            - **tree\_height\_scale** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Deprecated alias for time\_scale. (Deprecated in
              0.3.6)
            - **title** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A title string to be included in the SVG output. If `None`
              (default) no title is shown, which gives more vertical space for the tree.
            - **max\_time** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*,*[*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The maximum plotted time value in the current
              scaling system (see `time_scale`). Can be either a string or a
              numeric value. If equal to `"tree"` (the default), the maximum time
              is set to be that of the oldest root in the tree. If equal to `"ts"` the
              maximum time is set to be the time of the oldest root in the tree
              sequence; this is useful when drawing trees from the same tree sequence as it
              ensures that node heights are consistent. If a numeric value, this is used as
              the maximum plotted time by which to scale other nodes.
            - **min\_time** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*,*[*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The minimum plotted time value in the current
              scaling system (see `time_scale`). Can be either a string or a
              numeric value. If equal to `"tree"` (the default), the minimum time
              is set to be that of the youngest node in the tree. If equal to `"ts"` the
              minimum time is set to be the time of the youngest node in the tree
              sequence; this is useful when drawing trees from the same tree sequence as it
              ensures that node heights are consistent. If a numeric value, this is used as
              the minimum plotted time.
            - **max\_tree\_height** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*,*[*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – Deprecated alias for max\_time. (Deprecated in
              0.3.6)
            - **node\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – If specified, show custom labels for the nodes
              (specified by ID) that are present in this map; any nodes not present will
              not have a label. To use a metadata key, for example, use
              `node_labels={node.id: node.metadata["key"] for node in ts.nodes()}`.
            - **mutation\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – If specified, show custom labels for the
              mutations (specified by ID) that are present in the map; any mutations
              not present will not have a label.
            - **node\_titles** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – If specified, add a `<title>` string to
              symbols for each node (specified by ID) present in this map. SVG visualizers
              such as web browsers will commonly display this string on mousing over the
              node symbol.
            - **mutation\_titles** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – If specified, add a `<title>` string to
              symbols for each mutation (specified by ID) present in this map. SVG
              visualizers such as web browsers will commonly display this string on
              mousing over the mutation symbol in the tree and (if show) on the x axis.
            - **root\_svg\_attributes** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – Additional attributes, such as an id, that will
              be embedded in the root `<svg>` tag of the generated drawing.
            - **style** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A
              [css style string](https://www.w3.org/TR/CSS22/syndata.html) that will be
              included in the `<style>` tag of the generated svg.
            - **order** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The left-to-right ordering of child nodes in the drawn tree.
              This can be either: `"minlex"`, which minimises the differences
              between adjacent trees (see also the `"minlex_postorder"` traversal
              order for the [`nodes()`](#tskit.Tree.nodes "tskit.Tree.nodes") method); or `"tree"` which draws trees
              in the left-to-right order defined by the
              [quintuply linked tree structure](data-model.html#sec-data-model-tree-structure).
              If not specified or None, this defaults to `"minlex"`.
            - **force\_root\_branch** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True` always plot a branch (edge) above the
              root(s) in the tree. If `None` (default) then only plot such root branches
              if there is a mutation above a root of the tree.
            - **symbol\_size** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – Change the default size of the node and mutation
              plotting symbols. If `None` (default) use a standard size.
            - **x\_axis** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Should the plot have an X axis line, showing the start and
              end position of this tree along the genome. If `None` (default) do not
              plot an X axis.
            - **x\_label** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Place a label under the plot. If `None` (default) and
              there is an X axis, create and place an appropriate label.
            - **x\_regions** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – A dictionary mapping (left, right) tuples to names. This
              draws a box, labelled with the name, on the X axis between the left and
              right positions, and can be used for annotating genomic regions (e.g.
              genes) on the X axis. If `None` (default) do not plot any regions.
            - **y\_axis** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Should the plot have an Y axis line, showing time (or
              ranked node time if `time_scale="rank"`). If `None` (default)
              do not plot a Y axis.
            - **y\_label** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Place a label to the left of the plot. If `None` (default)
              and there is a Y axis, create and place an appropriate label.
            - **y\_ticks** (*Union**[*[*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*,* [*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*]*) – A list of Y values at which to plot
              tickmarks, or a dictionary mapping Y values to labels (`[]` gives no
              tickmarks). If `None` (default), plot one tickmark for each unique node
              value. Note that if `time_scale="rank"`, the Y values refer to the
              zero-based rank of the plotted nodes, rather than the node time itself.
            - **y\_gridlines** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to plot horizontal lines behind the tree
              at each y tickmark.
            - **all\_edge\_mutations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – The edge on which a mutation occurs may span
              multiple trees. If `False` or `None` (default) mutations are only drawn
              on an edge if their site position exists within the genomic interval covered
              by this tree. If `True`, all mutations on each edge of the tree are drawn,
              even if their genomic position is to the left or right of the tree
              itself. Note that this means that independent drawings of different trees
              from the same tree sequence may share some plotted mutations.
            - **omit\_sites** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, omit sites and mutations from the drawing.
              Default: False
            - **canvas\_size** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*)*) – The (width, height) of the SVG canvas.
              This will change the SVG width and height without rescaling graphical
              elements, allowing extra room e.g. for unusually long labels. If `None`
              take the canvas size to be the same as the target drawing size (see
              `size`, above). Default: None
            - **preamble** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – SVG commands to be included at the start of the returned
              object, immediately after the opening tag. These can include custom svg
              elements such as legends or annotations or even entire `<svg>` elements.
              The preamble is not checked for validity, so it is up to the user to
              ensure that it is valid SVG. Default: None

        Returns:
        :   An SVG representation of a tree.

        Return type:
        :   [SVGString](#tskit.SVGString "tskit.SVGString")

    draw(*path=None*, *width=None*, *height=None*, *node\_labels=None*, *node\_colours=None*, *mutation\_labels=None*, *mutation\_colours=None*, *format=None*, *edge\_colours=None*, *time\_scale=None*, *tree\_height\_scale=None*, *max\_time=None*, *min\_time=None*, *max\_tree\_height=None*, *order=None*, *omit\_sites=None*)[[source]](_modules/tskit/trees.html#Tree.draw)[#](#tskit.Tree.draw "Link to this definition")
    :   Returns a drawing of this tree.

        When working in a Jupyter notebook, use the `IPython.display.SVG`
        function to display the SVG output from this function inline in the notebook:

        ```python
        SVG(tree.draw())
        ```

        The unicode format uses unicode [box drawing characters](https://en.wikipedia.org/wiki/Box-drawing_character) to render the tree.
        This allows rendered trees to be printed out to the terminal:

        ```python
        print(tree.draw(format="unicode"))
          6
        ┏━┻━┓
        ┃   5
        ┃ ┏━┻┓
        ┃ ┃  4
        ┃ ┃ ┏┻┓
        3 0 1 2
        ```

        The `node_labels` argument allows the user to specify custom labels
        for nodes, or no labels at all:

        ```python
        print(tree.draw(format="unicode", node_labels={}))
          ┃
        ┏━┻━┓
        ┃   ┃
        ┃ ┏━┻┓
        ┃ ┃  ┃
        ┃ ┃ ┏┻┓
        ┃ ┃ ┃ ┃
        ```

        Note: in some environments such as Jupyter notebooks with Windows or Mac,
        users have observed that the Unicode box drawings can be misaligned. In
        these cases, we recommend using the SVG or ASCII display formats instead.
        If you have a strong preference for aligned Unicode, you can try out the
        solution documented
        [here](https://github.com/tskit-dev/tskit/issues/189#issuecomment-499114811).

        Parameters:
        :   - **path** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The path to the file to write the output. If None, do not
              write to file.
            - **width** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The width of the image in pixels. If not specified, either
              defaults to the minimum size required to depict the tree (text formats)
              or 200 pixels.
            - **height** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The height of the image in pixels. If not specified, either
              defaults to the minimum size required to depict the tree (text formats)
              or 200 pixels.
            - **node\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom labels for the nodes
              that are present in the map. Any nodes not specified in the map will
              not have a node label.
            - **node\_colours** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom colours for the nodes
              given in the map. Any nodes not specified in the map will take the default
              colour; a value of `None` is treated as transparent and hence the node
              symbol is not plotted. (Only supported in the SVG format.)
            - **mutation\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom labels for the mutations
              (specified by ID) that are present in the map. Any mutations not in the map
              will not have a label. (Showing mutations is currently only supported in the
              SVG format)
            - **mutation\_colours** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom colours for the mutations
              given in the map (specified by ID). As for `node_colours`, mutations not
              present in the map take the default colour, and those mapping to `None`
              are not drawn. (Only supported in the SVG format.)
            - **format** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The format of the returned image. Currently supported
              are ‘svg’, ‘ascii’ and ‘unicode’. Note that the [`Tree.draw_svg()`](#tskit.Tree.draw_svg "tskit.Tree.draw_svg")
              method provides more comprehensive functionality for creating SVGs.
            - **edge\_colours** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom colours for the edge
              joining each node in the map to its parent. As for `node_colours`,
              unspecified edges take the default colour, and `None` values result in the
              edge being omitted. (Only supported in the SVG format.)
            - **time\_scale** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Control how height values for nodes are computed.
              If this is equal to `"time"`, node heights are proportional to their time
              values. If this is equal to `"log_time"`, node heights are proportional to
              their log(time) values. If it is equal to `"rank"`, node heights are spaced
              equally according to their ranked times. For SVG output the default is
              ‘time’-scale whereas for text output the default is ‘rank’-scale.
              Time scaling is not currently supported for text output.
            - **tree\_height\_scale** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Deprecated alias for time\_scale. (Deprecated in
              0.3.6)
            - **max\_time** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*,*[*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The maximum time value in the current
              scaling system (see `time_scale`). Can be either a string or a
              numeric value. If equal to `"tree"`, the maximum time is set to be
              that of the oldest root in the tree. If equal to `"ts"` the maximum
              time is set to be the time of the oldest root in the tree sequence;
              this is useful when drawing trees from the same tree sequence as it ensures
              that node heights are consistent. If a numeric value, this is used as the
              maximum time by which to scale other nodes. This parameter
              is not currently supported for text output.
            - **min\_time** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*,*[*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The minimum time value in the current
              scaling system (see `time_scale`). Can be either a string or a
              numeric value. If equal to `"tree"`, the minimum time is set to be
              that of the youngest node in the tree. If equal to `"ts"` the minimum
              time is set to be the time of the youngest node in the tree sequence;
              this is useful when drawing trees from the same tree sequence as it ensures
              that node heights are consistent. If a numeric value, this is used as the
              minimum time to display. This parameter is not currently supported for text
              output.
            - **max\_tree\_height** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Deprecated alias for max\_time. (Deprecated in
              0.3.6)
            - **order** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The left-to-right ordering of child nodes in the drawn tree.
              This can be either: `"minlex"`, which minimises the differences
              between adjacent trees (see also the `"minlex_postorder"` traversal
              order for the [`nodes()`](#tskit.Tree.nodes "tskit.Tree.nodes") method); or `"tree"` which draws trees
              in the left-to-right order defined by the
              [quintuply linked tree structure](data-model.html#sec-data-model-tree-structure).
              If not specified or None, this defaults to `"minlex"`.
            - **omit\_sites** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, omit sites and mutations from the drawing
              (only relevant to the SVG format). Default: False

        Returns:
        :   A representation of this tree in the requested format.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    *property* num\_mutations[#](#tskit.Tree.num_mutations "Link to this definition")
    :   Returns the total number of mutations across all sites on this tree.

        Returns:
        :   The total number of mutations over all sites on this tree.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_sites[#](#tskit.Tree.num_sites "Link to this definition")
    :   Returns the number of sites on this tree.

        Returns:
        :   The number of sites on this tree.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    sites()[[source]](_modules/tskit/trees.html#Tree.sites)[#](#tskit.Tree.sites "Link to this definition")
    :   Returns an iterator over all the [sites](data-model.html#sec-site-table-definition)
        in this tree. Sites are returned in order of increasing ID
        (and also position). See the [`Site`](#tskit.Site "tskit.Site") class for details on
        the available fields for each site.

        Returns:
        :   An iterator over all sites in this tree.

    mutations()[[source]](_modules/tskit/trees.html#Tree.mutations)[#](#tskit.Tree.mutations "Link to this definition")
    :   Returns an iterator over all the
        [mutations](data-model.html#sec-mutation-table-definition) in this tree.
        Mutations are returned in their
        [order in the mutations table](data-model.html#sec-mutation-requirements),
        that is, by nondecreasing site ID, and within a site, by decreasing
        mutation time with parent mutations before their children.
        See the [`Mutation`](#tskit.Mutation "tskit.Mutation") class for details on the available fields for
        each mutation.

        The returned iterator is equivalent to iterating over all sites
        and all mutations in each site, i.e.:

        ```python
        for site in tree.sites():
            for mutation in site.mutations:
                yield mutation
        ```

        Returns:
        :   An iterator over all [`Mutation`](#tskit.Mutation "tskit.Mutation") objects in this tree.

        Return type:
        :   iter([`Mutation`](#tskit.Mutation "tskit.Mutation"))

    leaves(*u=None*)[[source]](_modules/tskit/trees.html#Tree.leaves)[#](#tskit.Tree.leaves "Link to this definition")
    :   Returns an iterator over all the leaves in this tree that descend from
        the specified node. If \(u\) is not specified, return all leaves on
        the tree (i.e. all leaves reachable from the tree root(s), see note below).

        Note

        \(u\) can be any node in the entire tree sequence, including ones
        which are not connected via branches to a root node of the tree. If
        called on such a node, the iterator will return “dead” leaves
        (see [Dead leaves and branches](data-model.html#sec-data-model-tree-dead-leaves-and-branches)) which cannot
        be reached from a root of this tree. However, dead leaves will never be
        returned if \(u\) is left unspecified.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   An iterator over all leaves in the subtree rooted at u.

        Return type:
        :   [collections.abc.Iterable](https://docs.python.org/3/library/collections.abc.html#collections.abc.Iterable "(in Python v3.14)")

    samples(*u=None*)[[source]](_modules/tskit/trees.html#Tree.samples)[#](#tskit.Tree.samples "Link to this definition")
    :   Returns an iterator over the numerical IDs of all the sample nodes in
        this tree that are underneath the node with ID `u`. If `u` is a sample,
        it is included in the returned iterator. If `u` is not a sample, it is
        possible for the returned iterator to be empty, for example if `u` is an
        [`isolated`](#tskit.Tree.is_isolated "tskit.Tree.is_isolated") node that is not part of the the current
        topology. If u is not specified, return all sample node IDs in the tree
        (equivalent to all the sample node IDs in the tree sequence).

        If the [`TreeSequence.trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") method is called with
        `sample_lists=True`, this method uses an efficient algorithm to find
        the sample nodes. If not, a simple traversal based method is used.

        Note

        The iterator is *not* guaranteed to return the sample node IDs in
        numerical or any other particular order.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   An iterator over all sample node IDs in the subtree rooted at u.

        Return type:
        :   [collections.abc.Iterable](https://docs.python.org/3/library/collections.abc.html#collections.abc.Iterable "(in Python v3.14)")

    num\_children(*u*)[[source]](_modules/tskit/trees.html#Tree.num_children)[#](#tskit.Tree.num_children "Link to this definition")
    :   Returns the number of children of the specified
        node (i.e., `len(tree.children(u))`)

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The number of immediate children of the node u in this tree.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    num\_samples(*u=None*)[[source]](_modules/tskit/trees.html#Tree.num_samples)[#](#tskit.Tree.num_samples "Link to this definition")
    :   Returns the number of sample nodes in this tree underneath the specified
        node (including the node itself). If u is not specified return
        the total number of samples in the tree.

        This is a constant time operation.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The number of samples in the subtree rooted at u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    num\_tracked\_samples(*u=None*)[[source]](_modules/tskit/trees.html#Tree.num_tracked_samples)[#](#tskit.Tree.num_tracked_samples "Link to this definition")
    :   Returns the number of samples in the set specified in the
        `tracked_samples` parameter of the [`TreeSequence.trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") method
        underneath the specified node. If the input node is not specified,
        return the total number of tracked samples in the tree.

        This is a constant time operation.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node of interest.

        Returns:
        :   The number of samples within the set of tracked samples in
            the subtree rooted at u.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    preorder(*u=-1*)[[source]](_modules/tskit/trees.html#Tree.preorder)[#](#tskit.Tree.preorder "Link to this definition")
    :   Returns a numpy array of node ids in [preorder](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order_(NLR)). If the node u
        is specified the traversal is rooted at this node (and it will be the first
        element in the returned array). Otherwise, all nodes reachable from the tree
        roots will be returned. See [Tree traversals](https://tskit.dev/tutorials/analysing_trees.html#sec-analysing-trees-traversals "(in Project name not set)") for
        examples.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – If specified, return all nodes in the subtree rooted at u
            (including u) in traversal order.

        Returns:
        :   Array of node ids

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    postorder(*u=-1*)[[source]](_modules/tskit/trees.html#Tree.postorder)[#](#tskit.Tree.postorder "Link to this definition")
    :   Returns a numpy array of node ids in [postorder](https://en.wikipedia.org/wiki/Tree_traversal##Post-order_(LRN)). If the node u
        is specified the traversal is rooted at this node (and it will be the last
        element in the returned array). Otherwise, all nodes reachable from the tree
        roots will be returned. See [Tree traversals](https://tskit.dev/tutorials/analysing_trees.html#sec-analysing-trees-traversals "(in Project name not set)") for
        examples.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – If specified, return all nodes in the subtree rooted at u
            (including u) in traversal order.

        Returns:
        :   Array of node ids

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    timeasc(*u=-1*)[[source]](_modules/tskit/trees.html#Tree.timeasc)[#](#tskit.Tree.timeasc "Link to this definition")
    :   Returns a numpy array of node ids. Starting at u, returns the reachable
        descendant nodes in order of increasing time (most recent first), falling back
        to increasing ID if times are equal. Also see
        [Tree traversals](https://tskit.dev/tutorials/analysing_trees.html#sec-analysing-trees-traversals "(in Project name not set)") for examples of how to use
        traversals.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – If specified, return all nodes in the subtree rooted at u
            (including u) in traversal order.

        Returns:
        :   Array of node ids

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    timedesc(*u=-1*)[[source]](_modules/tskit/trees.html#Tree.timedesc)[#](#tskit.Tree.timedesc "Link to this definition")
    :   Returns a numpy array of node ids. Starting at u, returns the reachable
        descendant nodes in order of decreasing time (least recent first), falling back
        to decreasing ID if times are equal. Also see
        [Tree traversals](https://tskit.dev/tutorials/analysing_trees.html#sec-analysing-trees-traversals "(in Project name not set)") for examples of how to use
        traversals.

        Parameters:
        :   **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – If specified, return all nodes in the subtree rooted at u
            (including u) in traversal order.

        Returns:
        :   Array of node ids

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    nodes(*root=None*, *order='preorder'*)[[source]](_modules/tskit/trees.html#Tree.nodes)[#](#tskit.Tree.nodes "Link to this definition")
    :   Returns an iterator over the node IDs reachable from the specified node in this
        tree in the specified traversal order.

        Note

        Unlike the [`TreeSequence.nodes()`](#tskit.TreeSequence.nodes "tskit.TreeSequence.nodes") method, this iterator produces
        integer node IDs, not [`Node`](#tskit.Node "tskit.Node") objects.

        If the `root` parameter is not provided or `None`, iterate over all
        nodes reachable from the roots (see [`Tree.roots`](#tskit.Tree.roots "tskit.Tree.roots") for details
        on which nodes are considered roots). If the `root` parameter
        is provided, only the nodes in the subtree rooted at this node
        (including the specified node) will be iterated over. If the
        [`virtual_root`](#tskit.Tree.virtual_root "tskit.Tree.virtual_root") is specified as the traversal root, it will
        be included in the traversed nodes in the appropriate position
        for the given ordering. (See the
        [tree roots](data-model.html#sec-data-model-tree-virtual-root) section for more
        information on the virtual root.)

        The `order` parameter defines the order in which tree nodes are visited
        in the iteration (also see the [Tree traversals](https://tskit.dev/tutorials/analysing_trees.html#sec-analysing-trees-traversals "(in Project name not set)") section
        in the [tutorials](https://tskit.dev/tutorials)). The available orders are:

        - ‘preorder’: starting at root, yield the current node, then recurse
          and do a preorder on each child of the current node. See also [Wikipedia](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order_(NLR)).
        - ‘inorder’: starting at root, assuming binary trees, recurse and do
          an inorder on the first child, then yield the current node, then
          recurse and do an inorder on the second child. In the case of `n`
          child nodes (not necessarily 2), the first `n // 2` children are
          visited in the first stage, and the remaining `n - n // 2` children
          are visited in the second stage. See also [Wikipedia](https://en.wikipedia.org/wiki/Tree_traversal#In-order_(LNR)).
        - ‘postorder’: starting at root, recurse and do a postorder on each
          child of the current node, then yield the current node. See also
          [Wikipedia](https://en.wikipedia.org/wiki/Tree_traversal#Post-order_(LRN)).
        - ‘levelorder’ (‘breadthfirst’): visit the nodes under root (including
          the root) in increasing order of their depth from root. See also
          [Wikipedia](https://en.wikipedia.org/wiki/Tree_traversal#Breadth-first_search_/_level_order).
        - ‘timeasc’: visits the nodes in order of increasing time, falling back to
          increasing ID if times are equal.
        - ‘timedesc’: visits the nodes in order of decreasing time, falling back to
          decreasing ID if times are equal.
        - ‘minlex\_postorder’: a usual postorder has ambiguity in the order in
          which children of a node are visited. We constrain this by outputting
          a postorder such that the leaves visited, when their IDs are
          listed out, have minimum [lexicographic order](https://en.wikipedia.org/wiki/Lexicographical_order) out of all valid
          traversals. This traversal is useful for drawing multiple trees of
          a `TreeSequence`, as it leads to more consistency between adjacent
          trees. Note that internal non-leaf nodes are not counted in
          assessing the lexicographic order.

        Parameters:
        :   - **root** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The root of the subtree we are traversing.
            - **order** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The traversal ordering. Currently ‘preorder’,
              ‘inorder’, ‘postorder’, ‘levelorder’ (‘breadthfirst’), ‘timeasc’ and
              ‘timedesc’ and ‘minlex\_postorder’ are supported.

        Returns:
        :   An iterator over the node IDs in the tree in some traversal order.

        Return type:
        :   [collections.abc.Iterable](https://docs.python.org/3/library/collections.abc.html#collections.abc.Iterable "(in Python v3.14)"), [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    as\_newick(*\**, *root=None*, *precision=None*, *node\_labels=None*, *include\_branch\_lengths=None*)[[source]](_modules/tskit/trees.html#Tree.as_newick)[#](#tskit.Tree.as_newick "Link to this definition")
    :   Returns a [newick encoding](https://en.wikipedia.org/wiki/Newick_format) of this tree.
        For example, a binary tree with 3 leaves generated by
        [`Tree.generate_balanced(3)`](#tskit.Tree.generate_balanced "tskit.Tree.generate_balanced")
        encodes as:

        ```python
        (n0:2,(n1:1,n2:1):1);
        ```

        By default [sample nodes](glossary.html#sec-data-model-definitions) are
        labelled using the form `f"n{node_id}"`, i.e. the sample node’s
        ID prefixed with the string `"n"`. Node labels can be specified
        explicitly using the `node_labels` argument, which is a mapping from
        integer node IDs to the corresponding string label. If a node is not
        present in the mapping, no label is associated with the node in
        output.

        Warning

        Node labels are **not** Newick escaped, so care must be taken
        to provide labels that will not break the encoding.

        Note

        Specifying a `node_labels` dictionary or setting
        `include_branch_lengths=False` results in a less efficient
        method being used to generate the newick output. The performance
        difference can be substantial for large trees.

        By default, branch lengths are printed out with sufficient precision
        for them to be recovered exactly in double precision (although note
        that this does not necessarily mean that we can precisely recover the
        corresponding node times, since branch lengths are obtained by
        subtraction). If all times on the tree sequence are discrete, then
        branch lengths are printed as integers. Otherwise, branch lengths are
        printed with 17 digits of precision (i.e., `"%.17f"` in
        printf-notation).

        The precision for branch lengths can be specified using the `precision`
        argument. Branch lengths can be omitted entirely by setting
        `include_branch_lengths=False`.

        If the `root` argument is specified, we return the newick encoding of
        the specified subtree, otherwise the full tree is returned. If the tree
        has [multiple roots](data-model.html#sec-data-model-tree-roots) and a root node
        is not explicitly specified, we raise a `ValueError`. This is because
        most libraries and downstream software consider a newick string that
        contains multiple disconnected subtrees an error, and it is therefore
        best to consider how such topologies should be interchanged on a
        case-by-base basis. A list of the newick strings for each root can be
        obtained by `[tree.as_newick(root=root) for root in tree.roots]`.

        Parameters:
        :   - **precision** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The numerical precision with which branch lengths are
              printed. If not specified or None default to 0 if the tree sequence
              contains only integer node times, or 17 otherwise.
            - **root** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – If specified, return the tree rooted at this node.
            - **node\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom labels for the nodes
              that are present in the map. Any nodes not specified in the map will
              not have a node label.
            - **include\_branch\_lengths** – If True (default), output branch lengths in the
              Newick string. If False, only output the topology, without branch lengths.

        Returns:
        :   A newick representation of this tree.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    newick(*precision=14*, *\**, *root=None*, *node\_labels=None*, *include\_branch\_lengths=True*)[[source]](_modules/tskit/trees.html#Tree.newick)[#](#tskit.Tree.newick "Link to this definition")
    :   Warning

        This method is deprecated and may be removed in future
        versions of tskit. Please use the [`as_newick()`](#tskit.Tree.as_newick "tskit.Tree.as_newick") method
        in new code.

        This method is a deprecated version of the [`as_newick()`](#tskit.Tree.as_newick "tskit.Tree.as_newick") method.
        Functionality is equivalent, except for the default node labels.

        By default, *leaf* nodes are labelled with their numerical ID + 1,
        and internal nodes are not labelled. This default strategy was originally
        used to mimic the output of the `ms` simulator. However, the choice
        of labelling leaf nodes rather than samples is problematic, and this
        behaviour is only retained to avoid breaking existing code which may
        rely on it.

        Other parameters behave as documented in the [`as_newick()`](#tskit.Tree.as_newick "tskit.Tree.as_newick") method.

        Parameters:
        :   - **precision** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The numerical precision with which branch lengths are
              printed. Defaults to 14.
            - **root** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – If specified, return the tree rooted at this node.
            - **node\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom labels for the nodes
              that are present in the map. Any nodes not specified in the map will
              not have a node label.
            - **include\_branch\_lengths** – If True (default), output branch lengths in the
              Newick string. If False, only output the topology, without branch lengths.

        Returns:
        :   A newick representation of this tree.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    as\_dict\_of\_dicts()[[source]](_modules/tskit/trees.html#Tree.as_dict_of_dicts)[#](#tskit.Tree.as_dict_of_dicts "Link to this definition")
    :   Convert tree to dict of dicts for conversion to a
        [networkx graph](https://networkx.github.io/documentation/stable/reference/classes/digraph.html).

        For example:

        ```python
        import networkx as nx
        nx.DiGraph(tree.as_dict_of_dicts())
        # undirected graphs work as well
        nx.Graph(tree.as_dict_of_dicts())
        ```

        Returns:
        :   Dictionary of dictionaries of dictionaries where the first key
            is the source, the second key is the target of an edge, and the
            third key is an edge annotation. At this point the only annotation
            is “branch\_length”, the length of the branch (in units of time).

    \_\_str\_\_()[[source]](_modules/tskit/trees.html#Tree.__str__)[#](#tskit.Tree.__str__ "Link to this definition")
    :   Return a plain text summary of a tree in a tree sequence

    \_repr\_html\_()[[source]](_modules/tskit/trees.html#Tree._repr_html_)[#](#tskit.Tree._repr_html_ "Link to this definition")
    :   Return an html summary of a tree in a tree sequence. Called by jupyter
        notebooks to render trees

    map\_mutations(*genotypes*, *alleles*, *ancestral\_state=None*)[[source]](_modules/tskit/trees.html#Tree.map_mutations)[#](#tskit.Tree.map_mutations "Link to this definition")
    :   Given observations for the samples in this tree described by the specified
        set of genotypes and alleles, return a parsimonious set of state transitions
        explaining these observations. The genotypes array is interpreted as indexes
        into the alleles list in the same manner as described in the
        [`TreeSequence.variants()`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants") method. Thus, if sample `j` carries the
        allele at index `k`, then we have `genotypes[j] = k`.
        Missing observations can be specified for a sample using the value
        `tskit.MISSING_DATA` (-1), in which case the state at this sample does not
        influence the ancestral state or the position of mutations returned. At least
        one non-missing observation must be provided. A maximum of 64 alleles are
        supported.

        The current implementation uses the Hartigan parsimony algorithm to determine
        the minimum number of state transitions required to explain the data. In this
        model, transitions between any of the non-missing states is equally likely.

        The returned values correspond directly to the data model for describing
        variation at sites using mutations. See the [Site Table](data-model.html#sec-site-table-definition)
        and [Mutation Table](data-model.html#sec-mutation-table-definition) definitions for details and background.

        The state reconstruction is returned as two-tuple, `(ancestral_state,
        mutations)`, where `ancestral_state` is the allele assigned to the
        tree root(s) and `mutations` is a list of [`Mutation`](#tskit.Mutation "tskit.Mutation") objects,
        ordered as [required in a mutation table](data-model.html#sec-mutation-requirements).
        For each mutation, `derived_state` is the new state after this mutation and
        `node` is the tree node immediately beneath the mutation (if there are unary
        nodes between two branch points, hence multiple nodes above which the
        mutation could be parsimoniously placed, the oldest node is used). The
        `parent` property contains the index in the returned list of the previous
        mutation on the path to root, or `tskit.NULL`
        if there are no previous mutations (see the [Mutation Table](data-model.html#sec-mutation-table-definition)
        for more information on the concept of mutation parents). All other attributes
        of the [`Mutation`](#tskit.Mutation "tskit.Mutation") object are undefined and should not be used.

        Note

        Sample states observed as missing in the input `genotypes` need
        not correspond to samples whose nodes are actually “missing” (i.e.,
        [isolated](data-model.html#sec-data-model-missing-data)) in the tree. In this
        case, mapping the mutations returned by this method onto the tree
        will result in these missing observations being imputed to the
        most parsimonious state.

        Because the `parent` in the returned list of mutations refers to the index
        in that list, if you are adding mutations to an existing tree sequence, you
        will need to maintain a map of list IDs to the newly added mutations, for
        instance:

        ```python
        last_tree = ts.last()
        anc_state, parsimonious_muts = last_tree.map_mutations([0, 1, 0], ("A", "T"))
        # Edit the tree sequence, see the "Tables and Editing" tutorial
        tables = ts.dump_tables()
        # add a new site at the end of ts, assumes there isn't one there already
        site_id = tables.sites.add_row(ts.sequence_length - 1, anc_state)

        mut_id_map = {tskit.NULL: tskit.NULL}  # don't change if parent id is -1
        for list_id, mutation in enumerate(parsimonious_muts):
            mut_id_map[list_id] = tables.mutations.append(
                mutation.replace(site=site_id, parent=mut_id_map[mutation.parent]))
        tables.sort()  # Redundant here, but needed if the site is not the last one
        new_ts = tables.tree_sequence()
        ```

        See the [Parsimony](https://tskit.dev/tutorials/analysing_trees.html#sec-analysing-trees-parsimony "(in Project name not set)") section in the tutorial
        for further examples of how to use this method.

        Parameters:
        :   - **genotypes** (*array\_like*) – The input observations for the samples in this tree.
            - **alleles** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")*(*[*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – The alleles for the specified `genotypes`. Each
              positive value in the `genotypes` array is treated as an index into this
              list of alleles.
            - **ancestral\_state** (*Union**[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*]*) – A fixed ancestral state, specified either as a
              non-negative integer less than the number of alleles, or a string which
              must be one of the `alleles` provided above. If `None` (default) then
              an ancestral state is chosen arbitrarily from among those that provide
              the most parsimonious placement of mutations. Note that if the ancestral
              state is specified, the placement of mutations may not be as parsimonious
              as that which could be achieved by leaving the ancestral state unspecified;
              additionally it may lead to mutations being placed above the root node(s) of
              the tree (for example if all the samples have a genotype of 1 but the
              ancestral state is fixed to be 0).

        Returns:
        :   The inferred ancestral state and list of mutations on this tree
            that encode the specified observations.

        Return type:
        :   ([str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)"), [list](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")([tskit.Mutation](#tskit.Mutation "tskit.Mutation")))

    kc\_distance(*other*, *lambda\_=0.0*)[[source]](_modules/tskit/trees.html#Tree.kc_distance)[#](#tskit.Tree.kc_distance "Link to this definition")
    :   Returns the Kendall-Colijn distance between the specified pair of trees.
        The `lambda_` parameter determines the relative weight of topology
        vs branch lengths in calculating the distance. If `lambda_` is 0
        (the default) we only consider topology, and if it is 1 we only
        consider branch lengths. See [Kendall & Colijn (2016)](https://academic.oup.com/mbe/article/33/10/2735/2925548) for details.

        The trees we are comparing to must have identical lists of sample
        nodes (i.e., the same IDs in the same order). The metric operates on
        samples, not leaves, so internal samples are treated identically to
        sample tips. Subtrees with no samples do not contribute to the metric.

        Parameters:
        :   - **other** ([*Tree*](#tskit.Tree "tskit.Tree")) – The other tree to compare to.
            - **lambda** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The KC metric lambda parameter determining the
              relative weight of topology and branch length.

        Returns:
        :   The computed KC distance between this tree and other.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    rf\_distance(*other*)[[source]](_modules/tskit/trees.html#Tree.rf_distance)[#](#tskit.Tree.rf_distance "Link to this definition")
    :   Returns the (unweighted) Robinson-Foulds distance between the specified pair
        of trees, where corresponding samples between the two trees are identified by
        node ID. The Robinson-Foulds distance (also known as the symmetric difference)
        is defined as the number of bipartitions that are present in one tree but
        not the other (see
        [Robinson & Foulds (1981)](https://doi.org/10.1016/0025-5564(81)90043-2)).
        This method returns the unnormalised RF distance: if the
        trees are strictly bifurcating, i.e. binary, the value can be
        normalised by dividing by the maximum, which is $2n-4$ for two rooted
        trees of $n$ samples (however, if the trees contain polytomies, the maximum
        RF distance is less easily defined).

        Note

        The RF distance can be sensitive to small changes in topology: in some
        cases, changing the position of a single leaf can result in the maximum
        RF distance. Therefore even if adjacent trees in a tree sequence differ
        by a single subtree-prune-and-regraft operation, the RF distance
        between them can be large.

        Parameters:
        :   **other** ([*Tree*](#tskit.Tree "tskit.Tree")) – The other tree to compare to. Trees are treated as rooted.

        Returns:
        :   The unweighted Robinson-Foulds distance between this tree and `other`.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If either tree has multiple roots, or the trees have
            different sample nodes.

    path\_length(*u*, *v*)[[source]](_modules/tskit/trees.html#Tree.path_length)[#](#tskit.Tree.path_length "Link to this definition")
    :   Returns the number of edges on the path in this tree between the two nodes.
        If the two nodes have a most recent common ancestor, then this is defined as
        `tree.depth(u) + tree.depth(v) - 2 * tree.depth(tree.mrca(u, v))`. If the nodes
        do not have an MRCA (i.e., they are in disconnected subtrees) the path length
        is infinity.

        Note

        This counts the number of “hops” between two nodes. To find the branch
        length distance between them, in units of time (i.e. the sum of edge lengths
        that separate two nodes) use the [`distance_between()`](#tskit.Tree.distance_between "tskit.Tree.distance_between") method instead.

        See also

        See also the [`depth()`](#tskit.Tree.depth "tskit.Tree.depth") method

        Parameters:
        :   - **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The first node for path length computation.
            - **v** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The second node for path length computation.

        Returns:
        :   The number of edges between the two nodes.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    distance\_between(*u*, *v*)[[source]](_modules/tskit/trees.html#Tree.distance_between)[#](#tskit.Tree.distance_between "Link to this definition")
    :   Returns the total distance between two nodes in the tree, expressed as
        the sum of “branch lengths” from both nodes to their most recent common ancestor.

        Parameters:
        :   - **u** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The first node for path length computation.
            - **v** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The second node for path length computation.

        Returns:
        :   The distance between the two nodes, the sum of “branch lengths” .

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    b1\_index()[[source]](_modules/tskit/trees.html#Tree.b1_index)[#](#tskit.Tree.b1_index "Link to this definition")
    :   Returns the
        [B1 balance index](https://treebalance.wordpress.com/b₁-index/)
        for this tree. This is defined as the inverse of the sum of all
        longest paths to leaves for each node besides roots.

        See also

        See [Shao and Sokal (1990)](https://www.jstor.org/stable/2992186) for details.

        Returns:
        :   The B1 balance index.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    b2\_index(*base=10*)[[source]](_modules/tskit/trees.html#Tree.b2_index)[#](#tskit.Tree.b2_index "Link to this definition")
    :   Returns the
        [B2 balance index](https://treebalance.wordpress.com/b₂-index/)
        this tree.
        This is defined as the Shannon entropy of the probability
        distribution to reach leaves assuming a random walk
        from a root. The default base is 10, following Shao and Sokal (1990).

        See also

        See [Shao and Sokal (1990)](https://www.jstor.org/stable/2992186) for details.

        Parameters:
        :   **base** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The base used for the logarithm in the
            Shannon entropy computation.

        Returns:
        :   The B2 balance index.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    colless\_index()[[source]](_modules/tskit/trees.html#Tree.colless_index)[#](#tskit.Tree.colless_index "Link to this definition")
    :   Returns the
        [Colless imbalance index](https://treebalance.wordpress.com/colless-index/)
        for this tree. This is defined as the sum of all differences between
        number of leaves subtended by the left and right child of each node.
        The Colless index is undefined for non-binary trees and trees with
        multiple roots. This method will raise a LibraryError if the tree is
        not singly-rooted and binary.

        See also

        See [Shao and Sokal (1990)](https://www.jstor.org/stable/2992186) for details.

        Returns:
        :   The Colless imbalance index.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    sackin\_index()[[source]](_modules/tskit/trees.html#Tree.sackin_index)[#](#tskit.Tree.sackin_index "Link to this definition")
    :   Returns the
        [Sackin imbalance index](https://treebalance.wordpress.com/sackin-index/)
        for this tree. This is defined as the sum of the depths of all leaves
        in the tree. Equivalent to `sum(tree.depth(u) for u in
        tree.leaves())`

        See also

        See [Shao and Sokal (1990)](https://www.jstor.org/stable/2992186) for details.

        Returns:
        :   The Sackin imbalance index.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    num\_lineages(*t*)[[source]](_modules/tskit/trees.html#Tree.num_lineages)[#](#tskit.Tree.num_lineages "Link to this definition")
    :   Returns the number of lineages present in this tree at time `t`. This
        is defined as the number of branches in this tree (reachable from the
        samples) that intersect with `t`. Thus, `tree.num_lineages(t)`
        is equal to 0 for any `t` greater than or equal to the time of
        the root in a singly-rooted tree.

        Note

        Note that this definition means that if a (non root) node
        with three children has time `t`, then it will count as one lineage,
        not three.

        Parameters:
        :   **t** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The time to count lineages at.

        Returns:
        :   The number of lineages in the tree at time t.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    split\_polytomies(*\**, *epsilon=None*, *method=None*, *record\_provenance=True*, *random\_seed=None*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#Tree.split_polytomies)[#](#tskit.Tree.split_polytomies "Link to this definition")
    :   Return a new [`Tree`](#tskit.Tree "tskit.Tree") where extra nodes and edges have been inserted
        so that any any node `u` with greater than 2 children — a multifurcation
        or “polytomy” — is resolved into successive bifurcations. New nodes are
        inserted at times fractionally less than than the time of node `u`.
        Times are allocated to different levels of the tree, such that any newly
        inserted sibling nodes will have the same time.

        By default, the times of the newly generated children of a particular
        node are the minimum representable distance in floating point arithmetic
        from their parents (using the [nextafter](https://numpy.org/doc/stable/reference/generated/numpy.nextafter.html)
        function). Thus, the generated branches have the shortest possible nonzero
        length. A fixed branch length between inserted nodes and their parents
        can also be specified by using the `epsilon` parameter.

        Note

        A tree sequence [requires](data-model.html#sec-valid-tree-sequence-requirements) that
        parents be older than children and that mutations are younger than the
        parent of the edge on which they lie. If a fixed `epsilon` is specifed
        and is not small enough compared to the distance between a polytomy and
        its oldest child (or oldest child mutation) these requirements may not
        be met. In this case an error will be raised.

        If the `method` is `"random"` (currently the only option, and the default
        when no method is specified), then for a node with \(n\) children, the
        \((2n - 3)! / (2^(n - 2) (n - 2!))\) possible binary trees with equal
        probability.

        The returned [`Tree`](#tskit.Tree "tskit.Tree") will have the same genomic span as this tree,
        and node IDs will be conserved (that is, node `u` in this tree will
        be the same node in the returned tree). The returned tree is derived from a
        tree sequence that contains only one non-degenerate tree, that is, where
        edges cover only the interval spanned by this tree.

        Parameters:
        :   - **epsilon** – If specified, the fixed branch length between inserted
              nodes and their parents. If None (the default), the minimal possible
              nonzero branch length is generated for each node.
            - **method** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The method used to break polytomies. Currently only “random”
              is supported, which can also be specified by `method=None`
              (Default: `None`).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
              provenance information of the returned tree sequence. (Default: True).
            - **random\_seed** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The random seed. If this is None, a random seed will
              be automatically generated. Valid random seeds must be between 1 and
              \(2^32 − 1\).
            - **\*\*kwargs** – Further arguments used as parameters when constructing the
              returned [`Tree`](#tskit.Tree "tskit.Tree"). For example
              `tree.split_polytomies(sample_lists=True)` will
              return a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   A new tree with polytomies split into random bifurcations.

        Return type:
        :   [tskit.Tree](#tskit.Tree "tskit.Tree")

    *static* generate\_star(*num\_leaves*, *\**, *span=1*, *branch\_length=1*, *record\_provenance=True*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#Tree.generate_star)[#](#tskit.Tree.generate_star "Link to this definition")
    :   Generate a [`Tree`](#tskit.Tree "tskit.Tree") whose leaf nodes all have the same parent (i.e.,
        a “star” tree). The leaf nodes are all at time 0 and are marked as sample nodes.

        The tree produced by this method is identical to
        `tskit.Tree.unrank(n, (0, 0))`, but generated more efficiently for large `n`.

        Parameters:
        :   - **num\_leaves** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of leaf nodes in the returned tree (must be
              2 or greater).
            - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The span of the tree, and therefore the
              [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") of the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence")
              property of the returned [`Tree`](#tskit.Tree "tskit.Tree").
            - **branch\_length** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The length of every branch in the tree (equivalent
              to the time of the root node).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
              provenance information of the returned tree sequence. (Default: True).
            - **\*\*kwargs** – Further arguments used as parameters when constructing the
              returned [`Tree`](#tskit.Tree "tskit.Tree"). For example
              `tskit.Tree.generate_star(sample_lists=True)` will
              return a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   A star-shaped tree. Its corresponding [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") is available
            via the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence") attribute.

        Return type:
        :   [Tree](#tskit.Tree "tskit.Tree")

    *static* generate\_balanced(*num\_leaves*, *\**, *arity=2*, *span=1*, *branch\_length=1*, *record\_provenance=True*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#Tree.generate_balanced)[#](#tskit.Tree.generate_balanced "Link to this definition")
    :   Generate a [`Tree`](#tskit.Tree "tskit.Tree") with the specified number of leaves that is maximally
        balanced. By default, the tree returned is binary, such that for each
        node that subtends \(n\) leaves, the left child will subtend
        \(\lfloor{n / 2}\rfloor\) leaves and the right child the
        remainder. Balanced trees with higher arity can also generated using the
        `arity` parameter, where the leaves subtending a node are distributed
        among its children analogously.

        In the returned tree, the leaf nodes are all at time 0, marked as samples,
        and labelled 0 to n from left-to-right. Internal node IDs are assigned
        sequentially from n in a postorder traversal, and the time of an internal
        node is the maximum time of its children plus the specified `branch_length`.

        Parameters:
        :   - **num\_leaves** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of leaf nodes in the returned tree (must be
              be 2 or greater).
            - **arity** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The maximum number of children a node can have in the returned
              tree.
            - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The span of the tree, and therefore the
              [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") of the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence")
              property of the returned [`Tree`](#tskit.Tree "tskit.Tree").
            - **branch\_length** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The minimum length of a branch in the tree (see
              above for details on how internal node times are assigned).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
              provenance information of the returned tree sequence. (Default: True).
            - **\*\*kwargs** – Further arguments used as parameters when constructing the
              returned [`Tree`](#tskit.Tree "tskit.Tree"). For example
              `tskit.Tree.generate_balanced(sample_lists=True)` will
              return a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   A balanced tree. Its corresponding [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") is available
            via the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence") attribute.

        Return type:
        :   [Tree](#tskit.Tree "tskit.Tree")

    *static* generate\_comb(*num\_leaves*, *\**, *span=1*, *branch\_length=1*, *record\_provenance=True*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#Tree.generate_comb)[#](#tskit.Tree.generate_comb "Link to this definition")
    :   Generate a [`Tree`](#tskit.Tree "tskit.Tree") in which all internal nodes have two children
        and the left child is a leaf. This is a “comb”, “ladder” or “pectinate”
        phylogeny, and also known as a [caterpillar tree](https://en.wikipedia.org/wiki/Caterpillar_tree).

        The leaf nodes are all at time 0, marked as samples,
        and labelled 0 to n from left-to-right. Internal node IDs are assigned
        sequentially from n as we ascend the tree, and the time of an internal
        node is the maximum time of its children plus the specified `branch_length`.

        Parameters:
        :   - **num\_leaves** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of leaf nodes in the returned tree (must be
              2 or greater).
            - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The span of the tree, and therefore the
              [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") of the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence")
              property of the returned [`Tree`](#tskit.Tree "tskit.Tree").
            - **branch\_length** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The branch length between each internal node; the
              root node is therefore placed at time `branch_length * (num_leaves - 1)`.
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
              provenance information of the returned tree sequence. (Default: True).
            - **\*\*kwargs** – Further arguments used as parameters when constructing the
              returned [`Tree`](#tskit.Tree "tskit.Tree"). For example
              `tskit.Tree.generate_comb(sample_lists=True)` will
              return a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   A comb-shaped bifurcating tree. Its corresponding [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence")
            is available via the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence") attribute.

        Return type:
        :   [Tree](#tskit.Tree "tskit.Tree")

    *static* generate\_random\_binary(*num\_leaves*, *\**, *span=1*, *branch\_length=1*, *random\_seed=None*, *record\_provenance=True*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#Tree.generate_random_binary)[#](#tskit.Tree.generate_random_binary "Link to this definition")
    :   Generate a random binary [`Tree`](#tskit.Tree "tskit.Tree") with \(n\) = `num_leaves`
        leaves with an equal probability of returning any topology and
        leaf label permutation among the \((2n - 3)! / (2^{n - 2} (n - 2)!)\)
        leaf-labelled binary trees.

        The leaf nodes are marked as samples, labelled 0 to n, and placed at
        time 0. Internal node IDs are assigned sequentially from n as we ascend
        the tree, and the time of an internal node is the maximum time of its
        children plus the specified `branch_length`.

        Note

        The returned tree has not been created under any explicit model of
        evolution. In order to simulate such trees, additional software
        such as msprime <https://github.com/tskit-dev/msprime>` is required.

        Parameters:
        :   - **num\_leaves** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of leaf nodes in the returned tree (must
              be 2 or greater).
            - **span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The span of the tree, and therefore the
              [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") of the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence")
              property of the returned [`Tree`](#tskit.Tree "tskit.Tree").
            - **branch\_length** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The minimum time between parent and child nodes.
            - **random\_seed** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The random seed. If this is None, a random seed will
              be automatically generated. Valid random seeds must be between 1 and
              \(2^32 − 1\).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
              provenance information of the returned tree sequence. (Default: True).
            - **\*\*kwargs** – Further arguments used as parameters when constructing the
              returned [`Tree`](#tskit.Tree "tskit.Tree"). For example
              `tskit.Tree.generate_comb(sample_lists=True)` will
              return a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   A random binary tree. Its corresponding [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") is
            available via the [`tree_sequence`](#tskit.Tree.tree_sequence "tskit.Tree.tree_sequence") attribute.

        Return type:
        :   [Tree](#tskit.Tree "tskit.Tree")

#### The [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") class[#](#the-treesequence-class "Link to this heading")

Also see the [TreeSequence API](#sec-python-api-tree-sequences) summary.

*class* tskit.TreeSequence[[source]](_modules/tskit/trees.html#TreeSequence)[#](#tskit.TreeSequence "Link to this definition")
:   A single tree sequence, as defined by the [data model](data-model.html#sec-data-model).
    A TreeSequence instance can be created from a set of
    [tables](data-model.html#sec-table-definitions) using
    [`TableCollection.tree_sequence()`](#tskit.TableCollection.tree_sequence "tskit.TableCollection.tree_sequence"), or loaded from a set of text files
    using [`tskit.load_text()`](#tskit.load_text "tskit.load_text"), or loaded from a native binary file using
    [`tskit.load()`](#tskit.load "tskit.load").

    TreeSequences are immutable. To change the data held in a particular
    tree sequence, first get the table information as a [`TableCollection`](#tskit.TableCollection "tskit.TableCollection")
    instance (using [`dump_tables()`](#tskit.TreeSequence.dump_tables "tskit.TreeSequence.dump_tables")), edit those tables using the
    [tables api](#sec-tables-api), and create a new tree sequence using
    [`TableCollection.tree_sequence()`](#tskit.TableCollection.tree_sequence "tskit.TableCollection.tree_sequence").

    The [`trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") method iterates over all trees in a tree sequence, and
    the [`variants()`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants") method iterates over all sites and their genotypes.

    equals(*other*, *\**, *ignore\_metadata=False*, *ignore\_ts\_metadata=False*, *ignore\_provenance=False*, *ignore\_timestamps=False*, *ignore\_tables=False*, *ignore\_reference\_sequence=False*)[[source]](_modules/tskit/trees.html#TreeSequence.equals)[#](#tskit.TreeSequence.equals "Link to this definition")
    :   Returns True if self and other are equal. Uses the underlying table
        equality, see [`TableCollection.equals()`](#tskit.TableCollection.equals "tskit.TableCollection.equals") for details and options.

    aslist(*\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.aslist)[#](#tskit.TreeSequence.aslist "Link to this definition")
    :   Returns the trees in this tree sequence as a list. Each tree is
        represented by a different instance of [`Tree`](#tskit.Tree "tskit.Tree"). As such, this
        method is inefficient and may use a large amount of memory, and should
        not be used when performance is a consideration. The [`trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees")
        method is the recommended way to efficiently iterate over the trees
        in a tree sequence.

        Parameters:
        :   **\*\*kwargs** – Further arguments used as parameters when constructing the
            returned trees. For example `ts.aslist(sample_lists=True)` will result
            in a list of [`Tree`](#tskit.Tree "tskit.Tree") instances created with `sample_lists=True`.

        Returns:
        :   A list of the trees in this tree sequence.

        Return type:
        :   [list](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")

    dump(*file\_or\_path*, *zlib\_compression=False*)[[source]](_modules/tskit/trees.html#TreeSequence.dump)[#](#tskit.TreeSequence.dump "Link to this definition")
    :   Writes the tree sequence to the specified path or file object.

        Parameters:
        :   - **file\_or\_path** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The file object or path to write the TreeSequence to.
            - **zlib\_compression** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – This parameter is deprecated and ignored.

    *property* reference\_sequence[#](#tskit.TreeSequence.reference_sequence "Link to this definition")
    :   The [`ReferenceSequence`](#tskit.ReferenceSequence "tskit.ReferenceSequence") associated with this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence")
        if one is defined (see [`TreeSequence.has_reference_sequence()`](#tskit.TreeSequence.has_reference_sequence "tskit.TreeSequence.has_reference_sequence")),
        or None otherwise.

    has\_reference\_sequence()[[source]](_modules/tskit/trees.html#TreeSequence.has_reference_sequence)[#](#tskit.TreeSequence.has_reference_sequence "Link to this definition")
    :   Returns True if this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") has an associated
        [reference sequence](data-model.html#sec-data-model-reference-sequence).

    *property* tables\_dict[#](#tskit.TreeSequence.tables_dict "Link to this definition")
    :   Returns a dictionary mapping names to tables in the
        underlying [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"). Equivalent to calling
        `ts.tables.table_name_map`.

    *property* tables[#](#tskit.TreeSequence.tables "Link to this definition")
    :   Returns an immutable view of the tables underlying this tree sequence.

        This view shares the same data as the TreeSequence (zero-copy).
        Use [`dump_tables()`](#tskit.TreeSequence.dump_tables "tskit.TreeSequence.dump_tables") for a modifiable copy.

        Note that if tskit was built with Numpy 1, this method acts as
        [`dump_tables()`](#tskit.TreeSequence.dump_tables "tskit.TreeSequence.dump_tables") and returns a mutable TableCollection.

        Returns:
        :   An immutable view of the TableCollection underlying this tree sequence.

    *property* nbytes[#](#tskit.TreeSequence.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this tree sequence. Note that this may not be equal to
        the actual memory footprint.

    dump\_tables()[[source]](_modules/tskit/trees.html#TreeSequence.dump_tables)[#](#tskit.TreeSequence.dump_tables "Link to this definition")
    :   Returns a modifiable copy of the [`tables`](#tskit.TableCollection "tskit.TableCollection") defining
        this tree sequence.

        Returns:
        :   A [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") containing all tables underlying
            the tree sequence.

        Return type:
        :   [TableCollection](#tskit.TableCollection "tskit.TableCollection")

    link\_ancestors(*samples*, *ancestors*)[[source]](_modules/tskit/trees.html#TreeSequence.link_ancestors)[#](#tskit.TreeSequence.link_ancestors "Link to this definition")
    :   Equivalent to [`TableCollection.link_ancestors()`](#tskit.TableCollection.link_ancestors "tskit.TableCollection.link_ancestors"); see that method for full
        documentation and parameter semantics.

        Parameters:
        :   - **samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – Node IDs to retain as samples.
            - **ancestors** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – Node IDs to treat as ancestors.

        Returns:
        :   An [`tables.EdgeTable`](#tskit.EdgeTable "tskit.tables.EdgeTable") containing the genealogical links between
            the supplied `samples` and `ancestors`.

        Return type:
        :   [tables.EdgeTable](#tskit.EdgeTable "tskit.tables.EdgeTable")

    dump\_text(*nodes=None*, *edges=None*, *sites=None*, *mutations=None*, *individuals=None*, *populations=None*, *migrations=None*, *provenances=None*, *precision=6*, *encoding='utf8'*, *base64\_metadata=True*)[[source]](_modules/tskit/trees.html#TreeSequence.dump_text)[#](#tskit.TreeSequence.dump_text "Link to this definition")
    :   Writes a text representation of the tables underlying the tree sequence
        to the specified connections.

        If Base64 encoding is not used, then metadata will be saved directly, possibly
        resulting in errors reading the tables back in if metadata includes whitespace.

        Parameters:
        :   - **nodes** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object (having a .write() method) to
              write the NodeTable to.
            - **edges** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object to write the EdgeTable to.
            - **sites** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object to write the SiteTable to.
            - **mutations** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object to write the
              MutationTable to.
            - **individuals** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object to write the
              IndividualTable to.
            - **populations** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object to write the
              PopulationTable to.
            - **migrations** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object to write the
              MigrationTable to.
            - **provenances** ([*io.TextIOBase*](https://docs.python.org/3/library/io.html#io.TextIOBase "(in Python v3.14)")) – The file-like object to write the
              ProvenanceTable to.
            - **precision** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of digits of precision.
            - **encoding** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Encoding used for text representation.
            - **base64\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Only used if a schema is not present on each table
              being dumped. If True, metadata is encoded using Base64
              encoding; otherwise, as plain text.

    \_\_str\_\_()[[source]](_modules/tskit/trees.html#TreeSequence.__str__)[#](#tskit.TreeSequence.__str__ "Link to this definition")
    :   Return a plain text summary of the contents of a tree sequence

    \_repr\_html\_()[[source]](_modules/tskit/trees.html#TreeSequence._repr_html_)[#](#tskit.TreeSequence._repr_html_ "Link to this definition")
    :   Return an html summary of a tree sequence. Called by jupyter notebooks
        to render a TreeSequence.

    *property* num\_samples[#](#tskit.TreeSequence.num_samples "Link to this definition")
    :   Returns the number of sample nodes in this tree sequence. This is also the
        number of sample nodes in each tree.

        Returns:
        :   The number of sample nodes in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* table\_metadata\_schemas[#](#tskit.TreeSequence.table_metadata_schemas "Link to this definition")
    :   The set of metadata schemas for the tables in this tree sequence.

    *property* discrete\_genome[#](#tskit.TreeSequence.discrete_genome "Link to this definition")
    :   Returns True if all genome coordinates in this TreeSequence are
        discrete integer values. This is true iff all the following are true:

        - The sequence length is discrete
        - All site positions are discrete
        - All left and right edge coordinates are discrete
        - All migration left and right coordinates are discrete

        Returns:
        :   True if this TreeSequence uses discrete genome coordinates.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    *property* discrete\_time[#](#tskit.TreeSequence.discrete_time "Link to this definition")
    :   Returns True if all time coordinates in this TreeSequence are
        discrete integer values. This is true iff all the following are true:

        - All node times are discrete
        - All mutation times are discrete
        - All migration times are discrete

        Note that `tskit.UNKNOWN_TIME` counts as discrete.

        Returns:
        :   True if this TreeSequence uses discrete time coordinates.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    *property* min\_time[#](#tskit.TreeSequence.min_time "Link to this definition")
    :   Returns the min time in this tree sequence. This is the minimum
        of the node times and mutation times.

        Note that mutation times with the value `tskit.UNKNOWN_TIME`
        are ignored.

        Returns:
        :   The min time of the nodes and mutations in this tree sequence.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    *property* max\_time[#](#tskit.TreeSequence.max_time "Link to this definition")
    :   Returns the max time in this tree sequence. This is the maximum
        of the node times and mutation times.

        Note that mutation times with the value `tskit.UNKNOWN_TIME`
        are ignored.

        Returns:
        :   The max time of the nodes and mutations in this tree sequence.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    *property* sequence\_length[#](#tskit.TreeSequence.sequence_length "Link to this definition")
    :   Returns the sequence length in this tree sequence. This defines the
        genomic scale over which tree coordinates are defined. Given a
        tree sequence with a sequence length \(L\), the constituent
        trees will be defined over the half-closed interval
        \([0, L)\). Each tree then covers some subset of this
        interval — see [`tskit.Tree.interval`](#tskit.Tree.interval "tskit.Tree.interval") for details.

        Returns:
        :   The length of the sequence in this tree sequence in bases.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    *property* metadata[#](#tskit.TreeSequence.metadata "Link to this definition")
    :   The decoded metadata for this TreeSequence.

    *property* metadata\_schema[#](#tskit.TreeSequence.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this TreeSequence.

    *property* time\_units[#](#tskit.TreeSequence.time_units "Link to this definition")
    :   String describing the units of the time dimension for this TreeSequence.

    *property* num\_edges[#](#tskit.TreeSequence.num_edges "Link to this definition")
    :   Returns the number of [edges](data-model.html#sec-edge-table-definition) in this
        tree sequence.

        Returns:
        :   The number of edges in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_trees[#](#tskit.TreeSequence.num_trees "Link to this definition")
    :   Returns the number of distinct trees in this tree sequence. This
        is equal to the number of trees returned by the [`trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees")
        method.

        Returns:
        :   The number of trees in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_sites[#](#tskit.TreeSequence.num_sites "Link to this definition")
    :   Returns the number of [sites](data-model.html#sec-site-table-definition) in
        this tree sequence.

        Returns:
        :   The number of sites in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_mutations[#](#tskit.TreeSequence.num_mutations "Link to this definition")
    :   Returns the number of [mutations](data-model.html#sec-mutation-table-definition)
        in this tree sequence.

        Returns:
        :   The number of mutations in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_individuals[#](#tskit.TreeSequence.num_individuals "Link to this definition")
    :   Returns the number of [individuals](data-model.html#sec-individual-table-definition) in
        this tree sequence.

        Returns:
        :   The number of individuals in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_nodes[#](#tskit.TreeSequence.num_nodes "Link to this definition")
    :   Returns the number of [nodes](data-model.html#sec-node-table-definition) in
        this tree sequence.

        Returns:
        :   The number of nodes in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_provenances[#](#tskit.TreeSequence.num_provenances "Link to this definition")
    :   Returns the number of [provenances](data-model.html#sec-provenance-table-definition)
        in this tree sequence.

        Returns:
        :   The number of provenances in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_populations[#](#tskit.TreeSequence.num_populations "Link to this definition")
    :   Returns the number of [populations](data-model.html#sec-population-table-definition)
        in this tree sequence.

        Returns:
        :   The number of populations in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* num\_migrations[#](#tskit.TreeSequence.num_migrations "Link to this definition")
    :   Returns the number of [migrations](data-model.html#sec-migration-table-definition)
        in this tree sequence.

        Returns:
        :   The number of migrations in this tree sequence.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    *property* max\_root\_time[#](#tskit.TreeSequence.max_root_time "Link to this definition")
    :   Returns the time of the oldest root in any of the trees in this tree sequence.
        This is usually equal to `np.max(ts.tables.nodes.time)` but may not be
        since there can be non-sample nodes that are not present in any tree. Note that
        isolated samples are also defined as roots (so there can be a max\_root\_time
        even in a tree sequence with no edges).

        Returns:
        :   The maximum time of a root in this tree sequence.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If there are no samples in the tree, and hence no roots (as
            roots are defined by the ends of the upward paths from the set of samples).

    migrations()[[source]](_modules/tskit/trees.html#TreeSequence.migrations)[#](#tskit.TreeSequence.migrations "Link to this definition")
    :   Returns an iterable sequence of all the
        [migrations](data-model.html#sec-migration-table-definition) in this tree sequence.

        Migrations are returned in nondecreasing order of the `time` value.

        Returns:
        :   An iterable sequence of all migrations.

        Return type:
        :   Sequence([`Migration`](#tskit.Migration "tskit.Migration"))

    individuals()[[source]](_modules/tskit/trees.html#TreeSequence.individuals)[#](#tskit.TreeSequence.individuals "Link to this definition")
    :   Returns an iterable sequence of all the
        [individuals](data-model.html#sec-individual-table-definition) in this tree sequence.

        Returns:
        :   An iterable sequence of all individuals.

        Return type:
        :   Sequence([`Individual`](#tskit.Individual "tskit.Individual"))

    nodes(*\**, *order=None*)[[source]](_modules/tskit/trees.html#TreeSequence.nodes)[#](#tskit.TreeSequence.nodes "Link to this definition")
    :   Returns an iterable sequence of all the [nodes](data-model.html#sec-node-table-definition)
        in this tree sequence.

        Note

        Although node ids are commonly ordered by node time, this is not a
        formal tree sequence requirement. If you wish to iterate over nodes in
        time order, you should therefore use `order="timeasc"` (and wrap the
        resulting sequence in the standard Python [`reversed()`](https://docs.python.org/3/library/functions.html#reversed "(in Python v3.14)") function
        if you wish to iterate over older nodes before younger ones)

        Parameters:
        :   **order** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The order in which the nodes should be returned: must be
            one of “id” (default) or “timeasc” (ascending order of time, then by
            ascending node id, matching the first two ordering requirements of
            parent nodes in a [`sorted`](#tskit.TableCollection.sort "tskit.TableCollection.sort") edge table).

        Returns:
        :   An iterable sequence of all nodes.

        Return type:
        :   Sequence([`Node`](#tskit.Node "tskit.Node"))

    edges()[[source]](_modules/tskit/trees.html#TreeSequence.edges)[#](#tskit.TreeSequence.edges "Link to this definition")
    :   Returns an iterable sequence of all the [edges](data-model.html#sec-edge-table-definition)
        in this tree sequence. Edges are returned in the order required
        for a [valid tree sequence](data-model.html#sec-valid-tree-sequence-requirements). So,
        edges are guaranteed to be ordered such that (a) all parents with a
        given ID are contiguous; (b) edges are returned in non-decreasing
        order of parent time ago; (c) within the edges for a given parent, edges
        are sorted first by child ID and then by left coordinate.

        Returns:
        :   An iterable sequence of all edges.

        Return type:
        :   Sequence([`Edge`](#tskit.Edge "tskit.Edge"))

    edge\_diffs(*include\_terminal=False*, *\**, *direction=1*)[[source]](_modules/tskit/trees.html#TreeSequence.edge_diffs)[#](#tskit.TreeSequence.edge_diffs "Link to this definition")
    :   Returns an iterator over all the [edges](data-model.html#sec-edge-table-definition) that
        are inserted and removed to build the trees as we move from left-to-right along
        the tree sequence. Each iteration yields a named tuple consisting of 3 values,
        `(interval, edges_out, edges_in)`. The first value, `interval`, is the
        genomic interval `(left, right)` covered by the incoming tree
        (see [`Tree.interval`](#tskit.Tree.interval "tskit.Tree.interval")). The second, `edges_out` is a list of the edges
        that were just-removed to create the tree covering the interval
        (hence `edges_out` will always be empty for the first tree). The last value,
        `edges_in`, is a list of edges that were just
        inserted to construct the tree covering the current interval.

        The edges returned within each `edges_in` list are ordered by ascending
        time of the parent node, then ascending parent id, then ascending child id.
        The edges within each `edges_out` list are the reverse order (e.g.
        descending parent time, parent id, then child\_id). This means that within
        each list, edges with the same parent appear consecutively.

        The `direction` argument can be used to control whether diffs are produced
        in the forward (left-to-right, increasing genome coordinate value)
        or reverse (right-to-left, decreasing genome coordinate value) direction.

        Parameters:
        :   - **include\_terminal** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If False (default), the iterator terminates
              after the final interval in the tree sequence (i.e., it does not
              report a final removal of all remaining edges), and the number
              of iterations will be equal to the number of trees in the tree
              sequence. If True, an additional iteration takes place, with the last
              `edges_out` value reporting all the edges contained in the final
              tree (with both `left` and `right` equal to the sequence length).
            - **direction** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The direction of travel along the sequence for
              diffs. Must be one of [`FORWARD`](#tskit.FORWARD "tskit.FORWARD") or [`REVERSE`](#tskit.REVERSE "tskit.REVERSE").
              (Default: [`FORWARD`](#tskit.FORWARD "tskit.FORWARD")).

        Returns:
        :   An iterator over the (interval, edges\_out, edges\_in) tuples. This
            is a named tuple, so the 3 values can be accessed by position
            (e.g. `returned_tuple[0]`) or name (e.g. `returned_tuple.interval`).

        Return type:
        :   [`collections.abc.Iterable`](https://docs.python.org/3/library/collections.abc.html#collections.abc.Iterable "(in Python v3.14)")

    sites()[[source]](_modules/tskit/trees.html#TreeSequence.sites)[#](#tskit.TreeSequence.sites "Link to this definition")
    :   Returns an iterable sequence of all the [sites](data-model.html#sec-site-table-definition)
        in this tree sequence. Sites are returned in order of increasing ID
        (and also position). See the [`Site`](#tskit.Site "tskit.Site") class for details on
        the available fields for each site.

        Returns:
        :   An iterable sequence of all sites.

        Return type:
        :   Sequence([`Site`](#tskit.Site "tskit.Site"))

    mutations()[[source]](_modules/tskit/trees.html#TreeSequence.mutations)[#](#tskit.TreeSequence.mutations "Link to this definition")
    :   Returns an iterator over all the
        [mutations](data-model.html#sec-mutation-table-definition) in this tree sequence.
        Mutations are returned in order of nondecreasing site ID.
        See the [`Mutation`](#tskit.Mutation "tskit.Mutation") class for details on the available fields for
        each mutation.

        The returned iterator is equivalent to iterating over all sites
        and all mutations in each site, i.e.:

        ```python
        for site in tree_sequence.sites():
            for mutation in site.mutations:
                yield mutation
        ```

        Returns:
        :   An iterator over all mutations in this tree sequence.

        Return type:
        :   iter([`Mutation`](#tskit.Mutation "tskit.Mutation"))

    populations()[[source]](_modules/tskit/trees.html#TreeSequence.populations)[#](#tskit.TreeSequence.populations "Link to this definition")
    :   Returns an iterable sequence of all the
        [populations](data-model.html#sec-population-table-definition) in this tree sequence.

        Returns:
        :   An iterable sequence of all populations.

        Return type:
        :   Sequence([`Population`](#tskit.Population "tskit.Population"))

    provenances()[[source]](_modules/tskit/trees.html#TreeSequence.provenances)[#](#tskit.TreeSequence.provenances "Link to this definition")
    :   Returns an iterable sequence of all the
        [provenances](data-model.html#sec-provenance-table-definition) in this tree sequence.

        Returns:
        :   An iterable sequence of all provenances.

        Return type:
        :   Sequence([`Provenance`](#tskit.Provenance "tskit.Provenance"))

    breakpoints(*as\_array=False*)[[source]](_modules/tskit/trees.html#TreeSequence.breakpoints)[#](#tskit.TreeSequence.breakpoints "Link to this definition")
    :   Returns the breakpoints that separate trees along the chromosome, including the
        two extreme points 0 and L. This is equivalent to:

        ```python
        iter([0] + [t.interval.right for t in self.trees()])
        ```

        By default we return an iterator over the breakpoints as Python float objects;
        if `as_array` is True we return them as a numpy array.

        Note that the `as_array` form will be more efficient and convenient in most
        cases; the default iterator behaviour is mainly kept to ensure compatibility
        with existing code.

        Parameters:
        :   **as\_array** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, return the breakpoints as a numpy array.

        Returns:
        :   The breakpoints defined by the tree intervals along the sequence.

        Return type:
        :   [collections.abc.Iterable](https://docs.python.org/3/library/collections.abc.html#collections.abc.Iterable "(in Python v3.14)") or [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")

    at(*position*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.at)[#](#tskit.TreeSequence.at "Link to this definition")
    :   Returns the tree covering the specified genomic location. The returned tree
        will have `tree.interval.left` <= `position` < `tree.interval.right`.
        See also [`Tree.seek()`](#tskit.Tree.seek "tskit.Tree.seek").

        Warning

        The current implementation of this operation is linear in the number of
        trees, so may be inefficient for large tree sequences. See
        [this issue](https://github.com/tskit-dev/tskit/issues/684) for more
        information.

        Parameters:
        :   - **position** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – A genomic location.
            - **\*\*kwargs** – Further arguments used as parameters when constructing the
              returned [`Tree`](#tskit.Tree "tskit.Tree"). For example `ts.at(2.5, sample_lists=True)` will
              result in a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   A new instance of [`Tree`](#tskit.Tree "tskit.Tree") positioned to cover the specified
            genomic location.

        Return type:
        :   [Tree](#tskit.Tree "tskit.Tree")

    at\_index(*index*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.at_index)[#](#tskit.TreeSequence.at_index "Link to this definition")
    :   Returns the tree at the specified index. See also [`Tree.seek_index()`](#tskit.Tree.seek_index "tskit.Tree.seek_index").

        Warning

        The current implementation of this operation is linear in the number of
        trees, so may be inefficient for large tree sequences. See
        [this issue](https://github.com/tskit-dev/tskit/issues/684) for more
        information.

        Parameters:
        :   - **index** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The index of the required tree.
            - **\*\*kwargs** – Further arguments used as parameters when constructing the
              returned [`Tree`](#tskit.Tree "tskit.Tree"). For example `ts.at_index(4, sample_lists=True)`
              will result in a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   A new instance of [`Tree`](#tskit.Tree "tskit.Tree") positioned at the specified index.

        Return type:
        :   [Tree](#tskit.Tree "tskit.Tree")

    first(*\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.first)[#](#tskit.TreeSequence.first "Link to this definition")
    :   Returns the first tree in this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence"). To iterate over all
        trees in the sequence, use the [`trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") method.

        Parameters:
        :   **\*\*kwargs** – Further arguments used as parameters when constructing the
            returned [`Tree`](#tskit.Tree "tskit.Tree"). For example `ts.first(sample_lists=True)` will
            result in a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   The first tree in this tree sequence.

        Return type:
        :   [`Tree`](#tskit.Tree "tskit.Tree").

    last(*\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.last)[#](#tskit.TreeSequence.last "Link to this definition")
    :   Returns the last tree in this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence"). To iterate over all
        trees in the sequence, use the [`trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") method.

        Parameters:
        :   **\*\*kwargs** – Further arguments used as parameters when constructing the
            returned [`Tree`](#tskit.Tree "tskit.Tree"). For example `ts.first(sample_lists=True)` will
            result in a [`Tree`](#tskit.Tree "tskit.Tree") created with `sample_lists=True`.

        Returns:
        :   The last tree in this tree sequence.

        Return type:
        :   [`Tree`](#tskit.Tree "tskit.Tree").

    trees(*tracked\_samples=None*, *\**, *sample\_lists=False*, *root\_threshold=1*, *sample\_counts=None*, *tracked\_leaves=None*, *leaf\_counts=None*, *leaf\_lists=None*)[[source]](_modules/tskit/trees.html#TreeSequence.trees)[#](#tskit.TreeSequence.trees "Link to this definition")
    :   Returns an iterator over the trees in this tree sequence. Each value
        returned in this iterator is an instance of [`Tree`](#tskit.Tree "tskit.Tree"). Upon
        successful termination of the iterator, the tree will be in the
        “cleared” null state.

        The `sample_lists` and `tracked_samples` parameters are passed
        to the [`Tree`](#tskit.Tree "tskit.Tree") constructor, and control
        the options that are set in the returned tree instance.

        Warning

        Do not store the results of this iterator in a list!
        For performance reasons, the same underlying object is used
        for every tree returned which will most likely lead to unexpected
        behaviour. If you wish to obtain a list of trees in a tree sequence
        please use `ts.aslist()` instead.

        Parameters:
        :   - **tracked\_samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – The list of samples to be tracked and
              counted using the [`Tree.num_tracked_samples()`](#tskit.Tree.num_tracked_samples "tskit.Tree.num_tracked_samples") method.
            - **sample\_lists** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, provide more efficient access
              to the samples beneath a given node using the
              [`Tree.samples()`](#tskit.Tree.samples "tskit.Tree.samples") method.
            - **root\_threshold** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The minimum number of samples that a node
              must be ancestral to for it to be in the list of roots. By default
              this is 1, so that isolated samples (representing missing data)
              are roots. To efficiently restrict the roots of the tree to
              those subtending meaningful topology, set this to 2. This value
              is only relevant when trees have multiple roots.
            - **sample\_counts** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Deprecated since 0.2.4.

        Returns:
        :   An iterator over the Trees in this tree sequence.

        Return type:
        :   collections.abc.Iterable, [`Tree`](#tskit.Tree "tskit.Tree")

    coiterate(*other*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.coiterate)[#](#tskit.TreeSequence.coiterate "Link to this definition")
    :   Returns an iterator over the pairs of trees for each distinct
        interval in the specified pair of tree sequences.

        Parameters:
        :   - **other** ([*TreeSequence*](#tskit.TreeSequence "tskit.TreeSequence")) – The other tree sequence from which to take trees. The
              sequence length must be the same as the current tree sequence.
            - **\*\*kwargs** – Further named arguments that will be passed to the
              [`trees()`](#tskit.TreeSequence.trees "tskit.TreeSequence.trees") method when constructing the returned trees.

        Returns:
        :   An iterator returning successive tuples of the form
            `(interval, tree_self, tree_other)`. For example, the first item returned
            will consist of an tuple of the initial interval, the first tree of the
            current tree sequence, and the first tree of the `other` tree sequence;
            the `.left` attribute of the initial interval will be 0 and the `.right`
            attribute will be the smallest non-zero breakpoint of the 2 tree sequences.

        Return type:
        :   iter([`Interval`](#tskit.Interval "tskit.Interval"), [`Tree`](#tskit.Tree "tskit.Tree"), [`Tree`](#tskit.Tree "tskit.Tree"))

    haplotypes(*\**, *isolated\_as\_missing=None*, *missing\_data\_character=None*, *samples=None*, *left=None*, *right=None*, *impute\_missing\_data=None*)[[source]](_modules/tskit/trees.html#TreeSequence.haplotypes)[#](#tskit.TreeSequence.haplotypes "Link to this definition")
    :   Returns an iterator over the strings of haplotypes that result from
        the trees and mutations in this tree sequence. Each haplotype string
        is guaranteed to be of the same length. A tree sequence with
        \(n\) requested nodes (default: the number of sample nodes) and with
        \(s\) sites lying between `left` and `right` will return a total
        of \(n\) strings of \(s\) alleles concatenated together, where an allele
        consists of a single ascii character (tree sequences that include alleles
        which are not a single character in length, or where the character is
        non-ascii, will raise an error). The first string returned is the
        haplotype for the first requested node, and so on.

        The alleles at each site must be represented by single byte characters,
        (i.e., variants must be single nucleotide polymorphisms, or SNPs), hence
        the strings returned will all be of length \(s\). If the `left`
        position is less than or equal to the position of the first site, for a
        haplotype `h`, the value of `h[j]` will therefore be the observed
        allelic state at site `j`.

        If `isolated_as_missing` is True (the default), isolated nodes without
        mutations directly above them (whether samples or non-samples) will be treated as
        [missing data](data-model.html#sec-data-model-missing-data) and will be
        represented in the string by the `missing_data_character`. If
        instead it is set to False, missing data will be assigned the ancestral state
        (unless they have mutations directly above them, in which case they will take
        the most recent derived mutational state for that node). This was the default
        behaviour in versions prior to 0.2.0. Prior to 0.3.0 the impute\_missing\_data
        argument controlled this behaviour.

        It is also possible to provide **non-sample** nodes via the `samples`
        argument if you wish to output haplotypes for (e.g.) internal nodes.
        See also the [`variants()`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants") iterator for site-centric access
        to genotypes for the requested nodes.

        Warning

        For large datasets, this method can consume a **very large** amount of
        memory! To output all the sample data, it is more efficient to iterate
        over sites rather than over samples.

        Returns:
        :   An iterator over the haplotype strings for the samples in
            this tree sequence.

        Parameters:
        :   - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the allele assigned to
              missing samples (i.e., isolated samples without mutations) is
              the `missing_data_character`. If False,
              missing samples will be assigned the ancestral state.
              Default: True.
            - **missing\_data\_character** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A single ascii character that will
              be used to represent missing data.
              If any normal allele contains this character, an error is raised.
              Default: ‘N’.
            - **samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – The node IDs for which to output haplotypes. If
              `None` (default), return haplotypes for all the sample nodes in the tree
              sequence, in the order given by the [`samples()`](#tskit.TreeSequence.samples "tskit.TreeSequence.samples") method. Non-sample
              nodes may also be provided.
            - **left** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Haplotype strings will start with the first site at or after
              this genomic position. If `None` (default) start at the first site.
            - **right** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Haplotype strings will end with the last site before this
              position. If `None` (default) assume `right` is the sequence length
              (i.e. the last character in the string will be the last site in the tree
              sequence).
            - **impute\_missing\_data** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – *Deprecated in 0.3.0. Use ``isolated\_as\_missing``, but inverting value.
              Will be removed in a future version*

        Return type:
        :   [collections.abc.Iterable](https://docs.python.org/3/library/collections.abc.html#collections.abc.Iterable "(in Python v3.14)")

        Raises:
        :   - [**TypeError**](https://docs.python.org/3/library/exceptions.html#TypeError "(in Python v3.14)") – if the `missing_data_character` or any of the alleles
              at a site are not a single ascii character.
            - [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – if the `missing_data_character` exists in one of the
              alleles

    variants(*\**, *samples=None*, *isolated\_as\_missing=None*, *alleles=None*, *impute\_missing\_data=None*, *copy=None*, *left=None*, *right=None*)[[source]](_modules/tskit/trees.html#TreeSequence.variants)[#](#tskit.TreeSequence.variants "Link to this definition")
    :   Returns an iterator over the variants between the `left` (inclusive)
        and `right` (exclusive) genomic positions in this tree sequence. Each
        returned [`Variant`](#tskit.Variant "tskit.Variant") object has a site, a list of possible allelic
        states and an array of genotypes for the specified `samples`. The
        `genotypes` value is a numpy array containing indexes into the
        `alleles` list. By default, this list is generated automatically for
        each site such that the first entry, `alleles[0]`, is the ancestral
        state and subsequent alleles are listed in no
        particular order. This means that the encoding of alleles in
        terms of genotype values can vary from site-to-site, which is
        sometimes inconvenient. It is possible to specify a fixed mapping
        from allele strings to genotype values using the `alleles`
        parameter. For example, if we set `alleles=("A", "C", "G", "T")`,
        this will map allele “A” to 0, “C” to 1 and so on (the
        [`ALLELES_ACGT`](#tskit.ALLELES_ACGT "tskit.ALLELES_ACGT") constant provides a shortcut for this
        common mapping).

        By default, genotypes are generated for all samples. The `samples`
        parameter allows us to specify the nodes for which genotypes are
        generated; output order of genotypes in the returned variants
        corresponds to the order of the samples in this list. It is also
        possible to provide **non-sample** nodes as an argument here, if you
        wish to generate genotypes for (e.g.) internal nodes. Missingness is
        detected for any requested node (sample or non-sample) when
        `isolated_as_missing` is True: if a node is isolated at a site (i.e.,
        has no parent and no children in the marginal tree) and has no mutation
        above it at that site, its genotype will be reported as
        [`MISSING_DATA`](#tskit.MISSING_DATA "tskit.MISSING_DATA") (-1). If `isolated_as_missing` is False, such
        nodes are assigned the site’s ancestral allele index.

        If isolated samples are present at a given site without mutations above them,
        they are interpreted by default as
        [missing data](data-model.html#sec-data-model-missing-data), and the genotypes array
        will contain a special value [`MISSING_DATA`](#tskit.MISSING_DATA "tskit.MISSING_DATA") (-1) to identify them
        while the `alleles` tuple will end with the value `None` (note that this
        will be the case whether or not we specify a fixed mapping using the
        `alleles` parameter; see the [`Variant`](#tskit.Variant "tskit.Variant") class for more details).
        Alternatively, if `isolated_as_missing` is set to to False, such isolated
        samples will not be treated as missing, and instead assigned the ancestral
        state (this was the default behaviour in versions prior to 0.2.0). Prior to
        0.3.0 the impute\_missing\_data argument controlled this behaviour.

        Parameters:
        :   - **samples** (*array\_like*) – An array of node IDs for which to generate
              genotypes, or None for all sample nodes. Default: None.
            - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the genotype value assigned to
              missing samples (i.e., isolated samples without mutations) is
              [`MISSING_DATA`](#tskit.MISSING_DATA "tskit.MISSING_DATA") (-1). If False, missing samples will be
              assigned the allele index for the ancestral state.
              Default: True.
            - **alleles** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")) – A tuple of strings defining the encoding of
              alleles as integer genotype values. At least one allele must be provided.
              If duplicate alleles are provided, output genotypes will always be
              encoded as the first occurrence of the allele. If None (the default),
              the alleles are encoded as they are encountered during genotype
              generation.
            - **impute\_missing\_data** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – *Deprecated in 0.3.0. Use ``isolated\_as\_missing``, but inverting value.
              Will be removed in a future version*
            - **copy** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If False re-use the same Variant object for each site such that any
              references held to it are overwritten when the next site is visited.
              If True return a fresh [`Variant`](#tskit.Variant "tskit.Variant") for each site. Default: True.
            - **left** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Start with the first site at or after
              this genomic position. If `None` (default) start at the first site.
            - **right** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – End with the last site before this position. If `None`
              (default) assume `right` is the sequence length, so that the last
              variant corresponds to the last site in the tree sequence.

        Returns:
        :   An iterator over all variants in this tree sequence.

        Return type:
        :   iter([`Variant`](#tskit.Variant "tskit.Variant"))

    genotype\_matrix(*\**, *samples=None*, *isolated\_as\_missing=None*, *alleles=None*, *impute\_missing\_data=None*)[[source]](_modules/tskit/trees.html#TreeSequence.genotype_matrix)[#](#tskit.TreeSequence.genotype_matrix "Link to this definition")
    :   Returns an \(m \times n\) numpy array of the genotypes in this
        tree sequence, where \(m\) is the number of sites and \(n\)
        is the number of requested nodes (default: the number of sample nodes).
        The genotypes are the indexes into the array of `alleles`, as
        described for the [`Variant`](#tskit.Variant "tskit.Variant") class.

        It is possible to provide **non-sample** nodes via the `samples`
        argument if you wish to generate genotypes for (e.g.) internal nodes.
        Missingness is detected for any requested node (sample or non-sample)
        when `isolated_as_missing` is True: if a node is isolated at a site
        (i.e., has no parent and no children in the marginal tree) and has no
        mutation above it at that site, its genotype will be reported as
        [`MISSING_DATA`](#tskit.MISSING_DATA "tskit.MISSING_DATA") (-1).

        Such nodes are treated as missing data by default. If
        `isolated_as_missing` is set to False, they will not be treated as
        missing, and will instead be assigned the ancestral state. This was the
        default behaviour in versions prior to 0.2.0. Prior to 0.3.0 the
        `impute_missing_data` argument controlled this behaviour.

        Warning

        This method can consume a **very large** amount of memory! If
        all genotypes are not needed at once, it is usually better to
        access them sequentially using the [`variants()`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants") iterator.

        Parameters:
        :   - **samples** (*array\_like*) – An array of node IDs for which to generate
              genotypes. If `None` (default), generate genotypes for all sample
              nodes. Non-sample nodes may also be provided, in which case genotypes
              will be generated for those nodes too.
            - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the genotype value assigned to
              isolated nodes without mutations (samples or non-samples) is
              [`MISSING_DATA`](#tskit.MISSING_DATA "tskit.MISSING_DATA") (-1). If False, such nodes will be
              assigned the allele index for the ancestral state.
              Default: True.
            - **alleles** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")) – A tuple of strings describing the encoding of
              alleles to genotype values. At least one allele must be provided.
              If duplicate alleles are provided, output genotypes will always be
              encoded as the first occurrence of the allele. If None (the default),
              the alleles are encoded as they are encountered during genotype
              generation.
            - **impute\_missing\_data** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – *Deprecated in 0.3.0. Use ``isolated\_as\_missing``, but inverting value.
              Will be removed in a future version*

        Returns:
        :   The full matrix of genotypes.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    alignments(*\**, *reference\_sequence=None*, *missing\_data\_character=None*, *isolated\_as\_missing=None*, *samples=None*, *left=None*, *right=None*)[[source]](_modules/tskit/trees.html#TreeSequence.alignments)[#](#tskit.TreeSequence.alignments "Link to this definition")
    :   Returns an iterator over the full sequence alignments for the defined samples
        in this tree sequence. Each yielded alignment `a` is a string of length
        `L` where the first character is the genomic sequence at the `start`
        position in the genome (defaulting to 0) and the last character is the
        genomic sequence one position before the `stop` value (defaulting to the
        [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") of this tree sequence, which must have
        [`discrete_genome`](#tskit.TreeSequence.discrete_genome "tskit.TreeSequence.discrete_genome") equal to True). By default `L` is therefore equal
        to the [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length"), and `a[j]` is the nucleotide value at
        genomic position `j`.

        Note

        This is inherently a **zero-based** representation of the sequence
        coordinate space. Care will be needed when interacting with other
        libraries and upstream coordinate spaces.

        The [sites](glossary.html#sec-data-model-definitions-site) in a tree sequence will
        usually only define the variation for a subset of the `L` nucleotide
        positions along the genome, and the remaining positions are filled using
        a [reference sequence](data-model.html#sec-data-model-reference-sequence).
        The reference sequence data is defined either via the
        `reference_sequence` parameter to this method, or embedded within
        with the tree sequence itself via the [`TreeSequence.reference_sequence`](#tskit.TreeSequence.reference_sequence "tskit.TreeSequence.reference_sequence").

        Site information from the tree sequence takes precedence over the reference
        sequence so that, for example, at a site with no mutations all samples
        will have the site’s ancestral state.

        The reference sequence bases are determined in the following way:

        - If the `reference_sequence` parameter is supplied this will be
          used, regardless of whether the tree sequence has an embedded
          reference sequence.
        - Otherwise, if the tree sequence has an embedded reference sequence,
          this will be used.
        - If the `reference_sequence` parameter is not specified and
          there is no embedded reference sequence, `L` copies of the
          `missing_data_character` (which defaults to ‘N’) are used
          instead.

        Warning

        The [`ReferenceSequence`](#tskit.ReferenceSequence "tskit.ReferenceSequence") API is preliminary and
        some behaviours may change in the future. In particular, a
        tree sequence is currently regarded as having an embedded reference
        sequence even if it only has some metadata defined. In this case
        the `reference_sequence` parameter will need to be explicitly set.

        Note

        Two common options for setting a reference sequence are:

        - Mark them as missing data, by setting
          `reference_sequence="N" * int(ts.sequence_length)`
        - Fill the gaps with random nucleotides, by setting
          `reference_sequence=tskit.random_nucleotides(ts.sequence_length)`.
          See the [`random_nucleotides()`](#tskit.random_nucleotides "tskit.random_nucleotides") function for more information.

        Warning

        Insertions and deletions are not currently supported and
        the alleles at each site must be represented by
        single byte characters, (i.e., variants must be single nucleotide
        polymorphisms, or SNPs).

        Missing data handling

        - If `isolated_as_missing=True` (default), nodes that are isolated
          (no parent and no children) are rendered as the missing character across
          each tree interval. At site positions, the per-site allele overrides the
          missing character; if a genotype is missing (`-1`), the missing
          character is retained.
        - If `isolated_as_missing=False`, no missing overlay is applied. At sites,
          genotypes are decoded as usual; at non-sites, bases come from the
          reference sequence.

        See also the [`variants()`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants") iterator for site-centric access
        to sample genotypes and [`haplotypes()`](#tskit.TreeSequence.haplotypes "tskit.TreeSequence.haplotypes") for access to sample sequences
        at just the sites in the tree sequence.

        Parameters:
        :   - **reference\_sequence** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The reference sequence to fill in
              gaps between sites in the alignments. If provided, it must be a
              string of length equal to [`sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length"); the sequence is
              sliced internally to the requested `[left, right)` interval.
            - **missing\_data\_character** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A single ascii character that will
              be used to represent missing data.
              If any normal allele contains this character, an error is raised.
              Default: ‘N’.
            - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, treat isolated nodes as missing
              across the covered tree intervals (see above). If None (default), this
              is treated as True.
            - **samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – The nodes for which to output alignments. If
              `None` (default), return alignments for all sample nodes in the order
              given by the [`samples()`](#tskit.TreeSequence.samples "tskit.TreeSequence.samples") method. Non-sample nodes are also supported
              and will be decoded at sites in the same way as samples.
            - **left** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Alignments will start at this genomic position. If `None`
              (default) alignments start at 0.
            - **right** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Alignments will stop before this genomic position.
              If `None` (default) alignments will continue until the end of the
              tree sequence.

        Returns:
        :   An iterator over the alignment strings for specified samples in
            this tree sequence, in the order given in `samples`. Each string has
            length `L = right - left`.

        Return type:
        :   [collections.abc.Iterable](https://docs.python.org/3/library/collections.abc.html#collections.abc.Iterable "(in Python v3.14)")

        Raises:
        :   - [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – if any genome coordinate in this tree sequence is not
              discrete, or if the `reference_sequence` is not of the correct length.
            - [**TypeError**](https://docs.python.org/3/library/exceptions.html#TypeError "(in Python v3.14)") – if any of the alleles at a site are not a
              single ascii character.

    *property* individuals\_population[#](#tskit.TreeSequence.individuals_population "Link to this definition")
    :   Returns the length-`num_individuals` array containing, for each
        individual, the `population` attribute of their nodes, or
        `tskit.NULL` for individuals with no nodes. Errors if any individual
        has nodes with inconsistent non-NULL populations.

    *property* individuals\_time[#](#tskit.TreeSequence.individuals_time "Link to this definition")
    :   Returns the length-`num_individuals` array containing, for each
        individual, the `time` attribute of their nodes or `np.nan` for
        individuals with no nodes. Errors if any individual has nodes with
        inconsistent times.

    *property* individuals\_location[#](#tskit.TreeSequence.individuals_location "Link to this definition")
    :   Convenience method returning the `num_individuals x n` array
        whose row k-th row contains the `location` property of the k-th
        individual. The method only works if all individuals’ locations
        have the same length (which is `n`), and errors otherwise.

    *property* individuals\_flags[#](#tskit.TreeSequence.individuals_flags "Link to this definition")
    :   Efficient access to the bitwise `flags` column in the
        [Individual Table](data-model.html#sec-individual-table-definition) as a numpy array (dtype=np.uint32).
        Equivalent to `ts.tables.individuals.flags` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* individuals\_metadata[#](#tskit.TreeSequence.individuals_metadata "Link to this definition")
    :   Efficient access to the `metadata` column in the
        [Individual Table](data-model.html#sec-individual-table-definition) as a structured numpy array.
        The returned dtype will depend on the metadata schema used. Only a subset
        of struct metadata schemas are supported.
        See [Structured array metadata](metadata.html#sec-structured-array-metadata) for more information.

    *property* individuals\_nodes[#](#tskit.TreeSequence.individuals_nodes "Link to this definition")
    :   Return an array of node IDs for each individual in the tree sequence.

        Returns:
        :   Array of shape (num\_individuals, max\_ploidy) containing node IDs.
            Values of -1 indicate unused slots for individuals with ploidy
            less than the maximum.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* nodes\_metadata[#](#tskit.TreeSequence.nodes_metadata "Link to this definition")
    :   Efficient access to the `metadata` column in the
        [Node Table](data-model.html#sec-node-table-definition) as a structured numpy array.
        The returned dtype will depend on the metadata schema used. Only a subset
        of struct metadata schemas are supported.
        See [Structured array metadata](metadata.html#sec-structured-array-metadata) for more information.

    *property* nodes\_time[#](#tskit.TreeSequence.nodes_time "Link to this definition")
    :   Efficient access to the `time` column in the
        [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.nodes.time` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* nodes\_flags[#](#tskit.TreeSequence.nodes_flags "Link to this definition")
    :   Efficient access to the bitwise `flags` column in the
        [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.uint32).
        Equivalent to `ts.tables.nodes.flags` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* nodes\_population[#](#tskit.TreeSequence.nodes_population "Link to this definition")
    :   Efficient access to the `population` column in the
        [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.nodes.population` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* nodes\_individual[#](#tskit.TreeSequence.nodes_individual "Link to this definition")
    :   Efficient access to the `individual` column in the
        [Node Table](data-model.html#sec-node-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.nodes.individual` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* edges\_left[#](#tskit.TreeSequence.edges_left "Link to this definition")
    :   Efficient access to the `left` column in the
        [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.edges.left` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* edges\_right[#](#tskit.TreeSequence.edges_right "Link to this definition")
    :   Efficient access to the `right` column in the
        [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.edges.right` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* edges\_parent[#](#tskit.TreeSequence.edges_parent "Link to this definition")
    :   Efficient access to the `parent` column in the
        [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.edges.parent` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* edges\_child[#](#tskit.TreeSequence.edges_child "Link to this definition")
    :   Efficient access to the `child` column in the
        [Edge Table](data-model.html#sec-edge-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.edges.child` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* edges\_metadata[#](#tskit.TreeSequence.edges_metadata "Link to this definition")
    :   Efficient access to the `metadata` column in the
        [Edge Table](data-model.html#sec-edge-table-definition) as a structured numpy array.
        The returned dtype will depend on the metadata schema used. Only a subset
        of struct metadata schemas are supported.
        See [Structured array metadata](metadata.html#sec-structured-array-metadata) for more information.

    *property* sites\_position[#](#tskit.TreeSequence.sites_position "Link to this definition")
    :   Efficient access to the `position` column in the
        [Site Table](data-model.html#sec-site-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.sites.position` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* sites\_ancestral\_state[#](#tskit.TreeSequence.sites_ancestral_state "Link to this definition")
    :   The `ancestral_state` column in the
        [Site Table](data-model.html#sec-site-table-definition) as a numpy array (dtype=StringDtype).

    *property* sites\_metadata[#](#tskit.TreeSequence.sites_metadata "Link to this definition")
    :   Efficient access to the `metadata` column in the
        [Site Table](data-model.html#sec-site-table-definition) as a structured numpy array.
        The returned dtype will depend on the metadata schema used. Only a subset
        of struct metadata schemas are supported.
        See [Structured array metadata](metadata.html#sec-structured-array-metadata) for more information.

    *property* mutations\_site[#](#tskit.TreeSequence.mutations_site "Link to this definition")
    :   Efficient access to the `site` column in the
        [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.mutations.site` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

        Note

        To efficently get an array of the number of mutations per site, you
        can use `np.bincount(ts.mutations_site, minlength=ts.num_sites)`.

    *property* mutations\_node[#](#tskit.TreeSequence.mutations_node "Link to this definition")
    :   Efficient access to the `node` column in the
        [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.mutations.node` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* mutations\_parent[#](#tskit.TreeSequence.mutations_parent "Link to this definition")
    :   Efficient access to the `parent` column in the
        [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.mutations.parent` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* mutations\_time[#](#tskit.TreeSequence.mutations_time "Link to this definition")
    :   Efficient access to the `time` column in the
        [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.mutations.time` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* mutations\_derived\_state[#](#tskit.TreeSequence.mutations_derived_state "Link to this definition")
    :   Access to the `derived_state` column in the
        [Mutation Table](data-model.html#sec-mutation-table-definition) as a numpy array (dtype=StringDtype).

    *property* mutations\_metadata[#](#tskit.TreeSequence.mutations_metadata "Link to this definition")
    :   Efficient access to the `metadata` column in the
        [Mutation Table](data-model.html#sec-mutation-table-definition) as a structured numpy array.
        The returned dtype will depend on the metadata schema used. Only a subset
        of struct metadata schemas are supported.
        See [Structured array metadata](metadata.html#sec-structured-array-metadata) for more information.

    *property* mutations\_edge[#](#tskit.TreeSequence.mutations_edge "Link to this definition")
    :   Return an array of the ID of the edge each mutation sits on in the tree sequence.

        Returns:
        :   Array of shape (num\_mutations,) containing edge IDs.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* mutations\_inherited\_state[#](#tskit.TreeSequence.mutations_inherited_state "Link to this definition")
    :   Return an array of the inherited state for each mutation in the tree sequence.

        The inherited state for a mutation is the state that existed at the site
        before the mutation occurred. This is either the ancestral state of the site
        (if the mutation has no parent) or the derived state of the mutation’s
        parent mutation (if it has a parent).

        Returns:
        :   Array of shape (num\_mutations,) containing inherited states.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")

    *property* migrations\_left[#](#tskit.TreeSequence.migrations_left "Link to this definition")
    :   Efficient access to the `left` column in the
        [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.migrations.left` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* migrations\_right[#](#tskit.TreeSequence.migrations_right "Link to this definition")
    :   Efficient access to the `right` column in the
        [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.migrations.right` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* migrations\_node[#](#tskit.TreeSequence.migrations_node "Link to this definition")
    :   Efficient access to the `node` column in the
        [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.migrations.node` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* migrations\_source[#](#tskit.TreeSequence.migrations_source "Link to this definition")
    :   Efficient access to the `source` column in the
        [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.migrations.source` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* migrations\_dest[#](#tskit.TreeSequence.migrations_dest "Link to this definition")
    :   Efficient access to the `dest` column in the
        [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.migrations.dest` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* migrations\_time[#](#tskit.TreeSequence.migrations_time "Link to this definition")
    :   Efficient access to the `time` column in the
        [Migration Table](data-model.html#sec-migration-table-definition) as a numpy array (dtype=np.float64).
        Equivalent to `ts.tables.migrations.time` (but avoiding the full copy
        of the table data that accessing `ts.tables` currently entails).

    *property* migrations\_metadata[#](#tskit.TreeSequence.migrations_metadata "Link to this definition")
    :   Efficient access to the `metadata` column in the
        [Migration Table](data-model.html#sec-migration-table-definition) as a structured numpy array.
        The returned dtype will depend on the metadata schema used. Only a subset
        of struct metadata schemas are supported.
        See [Structured array metadata](metadata.html#sec-structured-array-metadata) for more information.

    *property* populations\_metadata[#](#tskit.TreeSequence.populations_metadata "Link to this definition")
    :   Efficient access to the `metadata` column in the
        [Population Table](data-model.html#sec-population-table-definition) as a structured numpy array.
        The returned dtype will depend on the metadata schema used. Only a subset
        of struct metadata schemas are supported.
        See [Structured array metadata](metadata.html#sec-structured-array-metadata) for more information.

    *property* indexes\_edge\_insertion\_order[#](#tskit.TreeSequence.indexes_edge_insertion_order "Link to this definition")
    :   Efficient access to the `edge_insertion_order` column in the
        [Table indexes](data-model.html#sec-table-indexes) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.indexes.edge_insertion_order` (but avoiding
        the full copy of the table data that accessing `ts.tables`
        currently entails).

    *property* indexes\_edge\_removal\_order[#](#tskit.TreeSequence.indexes_edge_removal_order "Link to this definition")
    :   Efficient access to the `edge_removal_order` column in the
        [Table indexes](data-model.html#sec-table-indexes) as a numpy array (dtype=np.int32).
        Equivalent to `ts.tables.indexes.edge_removal_order` (but avoiding
        the full copy of the table data that accessing `ts.tables`
        currently entails).

    individual(*id\_*)[[source]](_modules/tskit/trees.html#TreeSequence.individual)[#](#tskit.TreeSequence.individual "Link to this definition")
    :   Returns the [individual](data-model.html#sec-individual-table-definition)
        in this tree sequence with the specified ID. As with python lists, negative
        IDs can be used to index backwards from the last individual.

        Return type:
        :   [`Individual`](#tskit.Individual "tskit.Individual")

    node(*id\_*)[[source]](_modules/tskit/trees.html#TreeSequence.node)[#](#tskit.TreeSequence.node "Link to this definition")
    :   Returns the [node](data-model.html#sec-node-table-definition) in this tree sequence
        with the specified ID. As with python lists, negative IDs can be used to
        index backwards from the last node.

        Return type:
        :   [`Node`](#tskit.Node "tskit.Node")

    edge(*id\_*)[[source]](_modules/tskit/trees.html#TreeSequence.edge)[#](#tskit.TreeSequence.edge "Link to this definition")
    :   Returns the [edge](data-model.html#sec-edge-table-definition) in this tree sequence
        with the specified ID. As with python lists, negative IDs can be used to
        index backwards from the last edge.

        Return type:
        :   [`Edge`](#tskit.Edge "tskit.Edge")

    migration(*id\_*)[[source]](_modules/tskit/trees.html#TreeSequence.migration)[#](#tskit.TreeSequence.migration "Link to this definition")
    :   Returns the [migration](data-model.html#sec-migration-table-definition) in this tree
        sequence with the specified ID. As with python lists, negative IDs can be
        used to index backwards from the last migration.

        Return type:
        :   [`Migration`](#tskit.Migration "tskit.Migration")

    mutation(*id\_*)[[source]](_modules/tskit/trees.html#TreeSequence.mutation)[#](#tskit.TreeSequence.mutation "Link to this definition")
    :   Returns the [mutation](data-model.html#sec-mutation-table-definition) in this tree sequence
        with the specified ID. As with python lists, negative IDs can be used to
        index backwards from the last mutation.

        Return type:
        :   [`Mutation`](#tskit.Mutation "tskit.Mutation")

    site(*id\_=None*, *\**, *position=None*)[[source]](_modules/tskit/trees.html#TreeSequence.site)[#](#tskit.TreeSequence.site "Link to this definition")
    :   Returns the [site](data-model.html#sec-site-table-definition) in this tree sequence
        with either the specified ID or position. As with python lists, negative IDs
        can be used to index backwards from the last site.

        When position is specified instead of site ID, a binary search is done
        on the list of positions of the sites to try to find a site
        with the user-specified position.

        Return type:
        :   [`Site`](#tskit.Site "tskit.Site")

    population(*id\_*)[[source]](_modules/tskit/trees.html#TreeSequence.population)[#](#tskit.TreeSequence.population "Link to this definition")
    :   Returns the [population](data-model.html#sec-population-table-definition)
        in this tree sequence with the specified ID. As with python lists, negative
        IDs can be used to index backwards from the last population.

        Return type:
        :   [`Population`](#tskit.Population "tskit.Population")

    provenance(*id\_*)[[source]](_modules/tskit/trees.html#TreeSequence.provenance)[#](#tskit.TreeSequence.provenance "Link to this definition")
    :   Returns the [provenance](data-model.html#sec-provenance-table-definition)
        in this tree sequence with the specified ID. As with python lists,
        negative IDs can be used to index backwards from the last provenance.

    samples(*population=None*, *\**, *population\_id=None*, *time=None*)[[source]](_modules/tskit/trees.html#TreeSequence.samples)[#](#tskit.TreeSequence.samples "Link to this definition")
    :   Returns an array of the sample node IDs in this tree sequence. If
        population is specified, only return sample IDs from that population.
        It is also possible to restrict samples by time using the parameter
        time. If time is a numeric value, only return sample IDs whose node
        time is approximately equal to the specified time. If time is a pair
        of values of the form (min\_time, max\_time), only return sample IDs
        whose node time t is in this interval such that min\_time <= t < max\_time.

        Parameters:
        :   - **population** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The population of interest. If None, do not
              filter samples by population.
            - **population\_id** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Deprecated alias for `population`.
            - **time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")*,*[*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")) – The time or time interval of interest. If
              None, do not filter samples by time.

        Returns:
        :   A numpy array of the node IDs for the samples of interest,
            listed in numerical order.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    as\_vcf(*\*args*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.as_vcf)[#](#tskit.TreeSequence.as_vcf "Link to this definition")
    :   Return the result of [`write_vcf()`](#tskit.TreeSequence.write_vcf "tskit.TreeSequence.write_vcf") as a string.
        Keyword parameters are as defined in [`write_vcf()`](#tskit.TreeSequence.write_vcf "tskit.TreeSequence.write_vcf").

        Returns:
        :   A VCF encoding of the variants in this tree sequence as a string.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    write\_vcf(*output*, *ploidy=None*, *\**, *contig\_id='1'*, *individuals=None*, *individual\_names=None*, *position\_transform=None*, *site\_mask=None*, *sample\_mask=None*, *isolated\_as\_missing=None*, *allow\_position\_zero=None*, *include\_non\_sample\_nodes=None*)[[source]](_modules/tskit/trees.html#TreeSequence.write_vcf)[#](#tskit.TreeSequence.write_vcf "Link to this definition")
    :   Convert the genetic variation data in this tree sequence to Variant
        Call Format and write to the specified file-like object.

        Multiploid samples in the output VCF are generated either using
        individual information in the data model (see
        [Individual Table](data-model.html#sec-individual-table-definition)), or by combining genotypes for
        adjacent sample nodes using the `ploidy` argument. See the
        [Constructing GT values](export.html#sec-export-vcf-constructing-gt) section for more details
        and examples.

        If individuals are defined in the
        data model (see [Individual Table](data-model.html#sec-individual-table-definition)), the genotypes
        for each of the individual’s nodes are combined into a phased
        multiploid values at each site. By default, all individuals are
        included with their sample nodes, individuals with no nodes are
        omitted. The `include_non_sample_nodes` argument can be used to
        included non-sample nodes in the output VCF.

        Subsets or permutations of the sample individuals may be specified
        using the `individuals` argument.

        Mixed-sample individuals (e.g., those associated with one node
        that is a sample and another that is not) in the data model will
        only have the sample nodes output by default. However, non-sample
        nodes can be included using the `include_non_sample_nodes` argument.

        If there are no individuals in the tree sequence,
        synthetic individuals are created by combining adjacent samples, and
        the number of samples combined is equal to the `ploidy` value (1 by
        default). For example, if we have a `ploidy` of 2 and 6 sample nodes,
        then we will have 3 diploid samples in the VCF, consisting of the
        combined genotypes for samples [0, 1], [2, 3] and [4, 5]. If we had
        genotypes 011110 at a particular variant, then we would output the
        diploid genotypes 0|1, 1|1 and 1|0 in VCF.

        Each individual in the output is identified by a string; these are the
        VCF “sample” names. By default, these are of the form `tsk_0`,
        `tsk_1` etc, up to the number of individuals, but can be manually
        specified using the `individual_names` argument. We do not check
        for duplicates in this array, or perform any checks to ensure that
        the output VCF is well-formed.

        Note

        The default individual names (VCF sample IDs) are always of
        the form `tsk_0`, `tsk_1`, …, `tsk_{N - 1}`, where
        N is the number of individuals we output. These numbers
        are **not** necessarily the individual IDs.

        The REF value in the output VCF is the ancestral allele for a site
        and ALT values are the remaining alleles. It is important to note,
        therefore, that for real data this means that the REF value for a given
        site **may not** be equal to the reference allele. We also do not
        check that the alleles result in a valid VCF—for example, it is possible
        to use the tab character as an allele, leading to a broken VCF.

        The ID value in the output VCF file is the integer ID of the
        corresponding [site](data-model.html#sec-site-table-definition) (`site.id`).
        These ID values can be utilized to match the contents of the VCF file
        to the sites in the tree sequence object.

        Note

        Older code often uses the `ploidy=2` argument, because old
        versions of msprime did not output individual data. Specifying
        individuals in the tree sequence is more robust, and since tree
        sequences now typically contain individuals (e.g., as produced by
        `msprime.sim_ancestry( )`), this is not necessary, and the
        `ploidy` argument can safely be removed as part of the process
        of updating from the msprime 0.x legacy API.

        Parameters:
        :   - **output** ([*io.IOBase*](https://docs.python.org/3/library/io.html#io.IOBase "(in Python v3.14)")) – The file-like object to write the VCF output.
            - **ploidy** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ploidy of the individuals to be written to
              VCF. This sample size must be evenly divisible by ploidy. Cannot be
              used if there is individual data in the tree sequence.
            - **contig\_id** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The value of the CHROM column in the output VCF.
            - **individuals** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*)*) – A list containing the individual IDs to
              corresponding to the VCF samples. Defaults to all individuals
              associated with sample nodes in the tree sequence.
              See the {ref}`sec\_export\_vcf\_constructing\_gt` section for more
              details and examples.
            - **individual\_names** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*(*[*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – A list of string names to identify
              individual columns in the VCF. In VCF nomenclature, these are the
              sample IDs. If specified, this must be a list of strings of
              length equal to the number of individuals to be output. Note that
              we do not check the form of these strings in any way, so that is
              is possible to output malformed VCF (for example, by embedding a
              tab character within on of the names). The default is to output
              `tsk_j` for the jth individual.
              See the [Individual names](export.html#sec-export-vcf-individual-names) for examples
              and more information.
            - **position\_transform** – A callable that transforms the
              site position values into integer valued coordinates suitable for
              VCF. The function takes a single positional parameter x and must
              return an integer numpy array the same dimension as x. By default,
              this is set to `numpy.round()` which will round values to the
              nearest integer. If the string “legacy” is provided here, the
              pre 0.2.0 legacy behaviour of rounding values to the nearest integer
              (starting from 1) and avoiding the output of identical positions
              by incrementing is used.
              See the [Modifying coordinates](export.html#sec-export-vcf-modifying-coordinates) for examples
              and more information.
            - **site\_mask** – A numpy boolean array (or something convertable to
              a numpy boolean array) with num\_sites elements, used to mask out
              sites in the output. If `site_mask[j]` is True, then this
              site (i.e., the line in the VCF file) will be omitted.
              See the [Masking output](export.html#sec-export-vcf-masking-output) for examples
              and more information.
            - **sample\_mask** – A numpy boolean array (or something convertable to
              a numpy boolean array) with num\_samples elements, or a callable
              that returns such an array, such that if
              `sample_mask[j]` is True, then the genotype for sample `j`
              will be marked as missing using a “.”. If `sample_mask` is a
              callable, it must take a single argument and return a boolean
              numpy array. This function will be called for each (unmasked) site
              with the corresponding [`Variant`](#tskit.Variant "tskit.Variant") object, allowing
              for dynamic masks to be generated.
              See the [Masking output](export.html#sec-export-vcf-masking-output) for examples
              and more information.
            - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the genotype value assigned to
              missing samples (i.e., isolated samples without mutations) is “.”
              If False, missing samples will be assigned the ancestral allele.
              See [`variants()`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants") for more information. Default: True.
            - **allow\_position\_zero** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True allow sites with position zero to be
              output to the VCF, otherwise if one is present an error will be raised.
              The VCF spec does not allow for sites at position 0. However, in practise
              many tools will be fine with this. Default: False.
            - **include\_non\_sample\_nodes** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, include non-sample nodes
              in the output VCF. By default, only sample nodes are included.

    write\_fasta(*file\_or\_path*, *\**, *wrap\_width=60*, *reference\_sequence=None*, *missing\_data\_character=None*, *isolated\_as\_missing=None*)[[source]](_modules/tskit/trees.html#TreeSequence.write_fasta)[#](#tskit.TreeSequence.write_fasta "Link to this definition")
    :   Writes the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") for this tree sequence to file in
        [FASTA](https://en.wikipedia.org/wiki/FASTA_format) format.
        Please see the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method for details on how
        reference sequences are handled.

        Alignments are returned for the
        [sample nodes](glossary.html#sec-data-model-definitions) in this tree
        sequence, and a sample with node id `u` is given the label
        `f"n{u}"`, following the same convention as the
        [`write_nexus()`](#tskit.TreeSequence.write_nexus "tskit.TreeSequence.write_nexus") and [`Tree.as_newick()`](#tskit.Tree.as_newick "tskit.Tree.as_newick") methods.

        The `wrap_width` parameter controls the maximum width of lines
        of sequence data in the output. By default this is 60
        characters in accordance with fasta standard outputs. To turn off
        line-wrapping of sequences, set `wrap_width` = 0.

        Example usage:

        ```python
        ts.write_fasta("output.fa")
        ```

        Parameters:
        :   - **file\_or\_path** – The file object or path to write the output.
              Paths can be either strings or [`pathlib.Path`](https://docs.python.org/3/library/pathlib.html#pathlib.Path "(in Python v3.14)") objects.
            - **wrap\_width** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of sequence
              characters to include on each line in the fasta file, before wrapping
              to the next line for each sequence, or 0 to turn off line wrapping.
              (Default=60).
            - **reference\_sequence** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – As for the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method.
            - **missing\_data\_character** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – As for the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method.
            - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – As for the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method.

    as\_fasta(*\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.as_fasta)[#](#tskit.TreeSequence.as_fasta "Link to this definition")
    :   Return the result of [`write_fasta()`](#tskit.TreeSequence.write_fasta "tskit.TreeSequence.write_fasta") as a string.
        Keyword parameters are as defined in [`write_fasta()`](#tskit.TreeSequence.write_fasta "tskit.TreeSequence.write_fasta").

        Returns:
        :   A FASTA encoding of the alignments in this tree sequence as a string.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    write\_nexus(*file\_or\_path*, *\**, *precision=None*, *include\_trees=None*, *include\_alignments=None*, *reference\_sequence=None*, *missing\_data\_character=None*, *isolated\_as\_missing=None*)[[source]](_modules/tskit/trees.html#TreeSequence.write_nexus)[#](#tskit.TreeSequence.write_nexus "Link to this definition")
    :   Returns a [nexus encoding](https://en.wikipedia.org/wiki/Nexus_file)
        of this tree sequence. By default, tree topologies are included
        in the output, and sequence data alignments are included by default
        if this tree sequence has discrete genome coordinates and one or
        more sites. Inclusion of these sections can be controlled manually
        using the `include_trees` and `include_alignments` parameters.

        Tree topologies and branch lengths are listed
        sequentially in the TREES block and the spatial location of each tree
        encoded within the tree name labels. Specifically, a tree spanning
        the interval \([x, y)`\) is given the name `f"t{x}^{y}"`
        (See below for a description of the precision at which these spatial
        coordinates are printed out).

        The [sample nodes](glossary.html#sec-data-model-definitions) in this tree
        sequence are regarded as taxa, and a sample with node id `u`
        is given the label `f"n{u}"`, following the same convention
        as the [`Tree.as_newick()`](#tskit.Tree.as_newick "tskit.Tree.as_newick") method.

        By default, genome positions are printed out with with sufficient
        precision for them to be recovered exactly in double precision.
        If the tree sequence is defined on a [`discrete_genome`](#tskit.TreeSequence.discrete_genome "tskit.TreeSequence.discrete_genome"),
        then positions are written out as integers. Otherwise, 17 digits
        of precision is used. Branch length precision defaults are handled
        in the same way as [`Tree.as_newick()`](#tskit.Tree.as_newick "tskit.Tree.as_newick").

        If the `precision` argument is provided, genome positions and
        branch lengths are printed out with this many digits of precision.

        For example, here is the nexus encoding of a simple tree sequence
        with integer times and genome coordinates with three samples
        and two trees:

        ```python
        #NEXUS
        BEGIN TAXA;
          DIMENSIONS NTAX=3;
          TAXLABELS n0 n1 n2;
        END;
        BEGIN TREES;
          TREE t0^2 = [&R] (n0:3,(n1:2,n2:2):1);
          TREE t2^10 = [&R] (n1:2,(n0:1,n2:1):1);
        END;
        ```

        If sequence data [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") are defined for this tree sequence
        and there is at least one site present, sequence alignment data will also
        be included by default (this can be suppressed by setting
        `include_alignments=False`). For example, this tree sequence has
        a sequence length of 10, two variable sites and no
        [reference sequence](data-model.html#sec-data-model-reference-sequence):

        ```python
        #NEXUS
        BEGIN TAXA;
          DIMENSIONS NTAX=3;
          TAXLABELS n0 n1 n2;
        END;
        BEGIN DATA;
          DIMENSIONS NCHAR=10;
          FORMAT DATATYPE=DNA MISSING=?;
          MATRIX
            n0 ??G??????T
            n1 ??A??????C
            n2 ??A??????C
          ;
        END;
        BEGIN TREES;
          TREE t0^10 = [&R] (n0:2,(n1:1,n2:1):1);
        END;
        ```

        Please see the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method for details on how
        reference sequences are handled.

        Note

        Note the default `missing_data_character` for this method
        is “?” rather then “N”, in keeping with common conventions for
        nexus data. This can be changed using the `missing_data_character`
        parameter.

        Warning

        [Missing data](data-model.html#sec-data-model-missing-data)
        is not supported for encoding tree topology information
        as our convention of using trees with multiple roots
        is not often supported by newick parsers. Thus, the method
        will raise a ValueError if we try to output trees with
        multiple roots.

        Parameters:
        :   - **precision** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The numerical precision with which branch lengths
              and tree positions are printed.
            - **include\_trees** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the tree topology information should
              be included; False otherwise (default=True).
            - **include\_alignments** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the sequence data alignment information
              should be included; False otherwise (default=True if sequence alignments
              are well-defined and the tree sequence contains at least one site).
            - **reference\_sequence** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – As for the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method.
            - **missing\_data\_character** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – As for the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method,
              but defaults to “?”.
            - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – As for the [`alignments()`](#tskit.TreeSequence.alignments "tskit.TreeSequence.alignments") method.

        Returns:
        :   A nexus representation of this [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence")

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    as\_nexus(*\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.as_nexus)[#](#tskit.TreeSequence.as_nexus "Link to this definition")
    :   Return the result of [`write_nexus()`](#tskit.TreeSequence.write_nexus "tskit.TreeSequence.write_nexus") as a string.
        Keyword parameters are as defined in [`write_nexus()`](#tskit.TreeSequence.write_nexus "tskit.TreeSequence.write_nexus").

        Returns:
        :   A nexus encoding of the alignments in this tree sequence as a string.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    to\_macs()[[source]](_modules/tskit/trees.html#TreeSequence.to_macs)[#](#tskit.TreeSequence.to_macs "Link to this definition")
    :   Return a [macs encoding](https://github.com/gchen98/macs)
        of this tree sequence.

        Returns:
        :   The macs representation of this TreeSequence as a string.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    simplify(*samples=None*, *\**, *map\_nodes=False*, *reduce\_to\_site\_topology=False*, *filter\_populations=None*, *filter\_individuals=None*, *filter\_sites=None*, *filter\_nodes=None*, *update\_sample\_flags=None*, *keep\_unary=False*, *keep\_unary\_in\_individuals=None*, *keep\_input\_roots=False*, *record\_provenance=True*, *filter\_zero\_mutation\_sites=None*)[[source]](_modules/tskit/trees.html#TreeSequence.simplify)[#](#tskit.TreeSequence.simplify "Link to this definition")
    :   Returns a simplified tree sequence that retains only the history of
        the nodes given in the list `samples`. If `map_nodes` is true,
        also return a numpy array whose `u`-th element is the ID of the node
        in the simplified tree sequence that corresponds to node `u` in the
        original tree sequence, or [`tskit.NULL`](#tskit.NULL "tskit.NULL") (-1) if `u` is no longer
        present in the simplified tree sequence.

        Note

        If you wish to simplify a set of tables that do not satisfy all
        requirements for building a TreeSequence, then use
        [`TableCollection.simplify()`](#tskit.TableCollection.simplify "tskit.TableCollection.simplify").

        If the `reduce_to_site_topology` parameter is True, the returned tree
        sequence will contain only topological information that is necessary to
        represent the trees that contain sites. If there are zero sites in this
        tree sequence, this will result in an output tree sequence with zero edges.
        When the number of sites is greater than zero, every tree in the output
        tree sequence will contain at least one site. For a given site, the
        topology of the tree containing that site will be identical
        (up to node ID remapping) to the topology of the corresponding tree
        in the input tree sequence.

        If `filter_populations`, `filter_individuals`, `filter_sites`, or
        `filter_nodes` is True, any of the corresponding objects that are not
        referenced elsewhere are filtered out. As this is the default behaviour,
        it is important to realise IDs for these objects may change through
        simplification. By setting these parameters to False, however, the
        corresponding tables can be preserved without changes.

        If `filter_nodes` is False, then the output node table will be
        unchanged except for updating the sample status of nodes and any ID
        remappings caused by filtering individuals and populations (if the
        `filter_individuals` and `filter_populations` options are enabled).
        Nodes that are in the specified list of `samples` will be marked as
        samples in the output, and nodes that are currently marked as samples
        in the node table but not in the specified list of `samples` will
        have their [`tskit.NODE_IS_SAMPLE`](#tskit.NODE_IS_SAMPLE "tskit.NODE_IS_SAMPLE") flag cleared. Note also that
        the order of the `samples` list is not meaningful when
        `filter_nodes` is False. In this case, the returned node mapping is
        always the identity mapping, such that `a[u] == u` for all nodes.

        Setting the `update_sample_flags` parameter to False disables the
        automatic sample status update of nodes (described above) from
        occuring, making it the responsibility of calling code to keep track of
        the ultimate sample status of nodes. This is an advanced option, mostly
        of use when combined with the `filter_nodes=False`,
        `filter_populations=False` and `filter_individuals=False` options,
        which then guarantees that the node table will not be altered by
        simplification.

        Parameters:
        :   - **samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – A list of node IDs to retain as samples. They
              need not be nodes marked as samples in the original tree sequence, but
              will constitute the entire set of samples in the returned tree sequence.
              If not specified or None, use all nodes marked with the IS\_SAMPLE flag.
              The list may be provided as a numpy array (or array-like) object
              (dtype=np.int32).
            - **map\_nodes** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, return a tuple containing the resulting
              tree sequence and a numpy array mapping node IDs in the current tree
              sequence to their corresponding node IDs in the returned tree sequence.
              If False (the default), return only the tree sequence object itself.
            - **reduce\_to\_site\_topology** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to reduce the topology down
              to the trees that are present at sites. (Default: False)
            - **filter\_populations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any populations that are
              not referenced by nodes after simplification; new population IDs are
              allocated sequentially from zero. If False, the population table will
              not be altered in any way. (Default: None, treated as True)
            - **filter\_individuals** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any individuals that are
              not referenced by nodes after simplification; new individual IDs are
              allocated sequentially from zero. If False, the individual table will
              not be altered in any way. (Default: None, treated as True)
            - **filter\_sites** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any sites that are
              not referenced by mutations after simplification; new site IDs are
              allocated sequentially from zero. If False, the site table will not
              be altered in any way. (Default: None, treated as True)
            - **filter\_nodes** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any nodes that are
              not referenced by edges after simplification. If False, the only
              potential change to the node table may be to change the node flags
              (if `samples` is specified and different from the existing samples).
              (Default: None, treated as True)
            - **update\_sample\_flags** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, update node flags to so that
              nodes in the specified list of samples have the NODE\_IS\_SAMPLE
              flag after simplification, and nodes that are not in this list
              do not. (Default: None, treated as True)
            - **keep\_unary** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, preserve unary nodes (i.e., nodes with
              exactly one child) that exist on the path from samples to root.
              (Default: False)
            - **keep\_unary\_in\_individuals** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, preserve unary nodes
              that exist on the path from samples to root, but only if they are
              associated with an individual in the individuals table. Cannot be
              specified at the same time as `keep_unary`. (Default: `None`,
              equivalent to False)
            - **keep\_input\_roots** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to retain history ancestral to the
              MRCA of the samples. If `False`, no topology older than the MRCAs of the
              samples will be included. If `True` the roots of all trees in the returned
              tree sequence will be the same roots as in the original tree sequence.
              (Default: False)
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, record details of this call to
              simplify in the returned tree sequence’s provenance information
              (Default: True).
            - **filter\_zero\_mutation\_sites** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Deprecated alias for `filter_sites`.

        Returns:
        :   The simplified tree sequence, or (if `map_nodes` is True)
            a tuple consisting of the simplified tree sequence and a numpy array
            mapping source node IDs to their corresponding IDs in the new tree
            sequence.

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence") or ([tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence"), [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)"))

    delete\_sites(*site\_ids*, *record\_provenance=True*)[[source]](_modules/tskit/trees.html#TreeSequence.delete_sites)[#](#tskit.TreeSequence.delete_sites "Link to this definition")
    :   Returns a copy of this tree sequence with the specified sites (and their
        associated mutations) entirely removed. The site IDs do not need to be in any
        particular order, and specifying the same ID multiple times does not have any
        effect (i.e., calling `tree_sequence.delete_sites([0, 1, 1])` has the same
        effect as calling `tree_sequence.delete_sites([0, 1])`.

        Note

        To remove only the mutations associated with a site, but keep the site
        itself, use the [`MutationTable.keep_rows()`](#tskit.MutationTable.keep_rows "tskit.MutationTable.keep_rows") method.

        Parameters:
        :   - **site\_ids** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – A list of site IDs specifying the sites to remove.
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation to the
              provenance information of the returned tree sequence. (Default: `True`).

    delete\_intervals(*intervals*, *simplify=True*, *record\_provenance=True*)[[source]](_modules/tskit/trees.html#TreeSequence.delete_intervals)[#](#tskit.TreeSequence.delete_intervals "Link to this definition")
    :   Returns a copy of this tree sequence for which information in the
        specified list of genomic intervals has been deleted. Edges spanning these
        intervals are truncated or deleted, and sites and mutations falling within
        them are discarded. Note that it is the information in the intervals that
        is deleted, not the intervals themselves, so in particular, all samples
        will be isolated in the deleted intervals.

        Note that node IDs may change as a result of this operation,
        as by default [`simplify()`](#tskit.TreeSequence.simplify "tskit.TreeSequence.simplify") is called on the returned tree sequence
        to remove redundant nodes. If you wish to map node IDs onto the same
        nodes before and after this method has been called, specify `simplify=False`.

        See also [`keep_intervals()`](#tskit.TreeSequence.keep_intervals "tskit.TreeSequence.keep_intervals"), [`ltrim()`](#tskit.TreeSequence.ltrim "tskit.TreeSequence.ltrim"), [`rtrim()`](#tskit.TreeSequence.rtrim "tskit.TreeSequence.rtrim"), and
        [missing data](data-model.html#sec-data-model-missing-data).

        Parameters:
        :   - **intervals** (*array\_like*) – A list (start, end) pairs describing the
              genomic intervals to delete. Intervals must be non-overlapping and
              in increasing order. The list of intervals must be interpretable as a
              2D numpy array with shape (N, 2), where N is the number of intervals.
            - **simplify** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, return a simplified tree sequence where nodes
              no longer used are discarded. (Default: True).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation to the
              provenance information of the returned tree sequence. (Default: `True`).

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

    keep\_intervals(*intervals*, *simplify=True*, *record\_provenance=True*)[[source]](_modules/tskit/trees.html#TreeSequence.keep_intervals)[#](#tskit.TreeSequence.keep_intervals "Link to this definition")
    :   Returns a copy of this tree sequence which includes only information in
        the specified list of genomic intervals. Edges are truncated to lie within
        these intervals, and sites and mutations falling outside these intervals
        are discarded. Note that it is the information outside the intervals that
        is deleted, not the intervals themselves, so in particular, all samples
        will be isolated outside of the retained intervals.

        Note that node IDs may change as a result of this operation,
        as by default [`simplify()`](#tskit.TreeSequence.simplify "tskit.TreeSequence.simplify") is called on the returned tree sequence
        to remove redundant nodes. If you wish to map node IDs onto the same
        nodes before and after this method has been called, specify `simplify=False`.

        See also [`keep_intervals()`](#tskit.TreeSequence.keep_intervals "tskit.TreeSequence.keep_intervals"), [`ltrim()`](#tskit.TreeSequence.ltrim "tskit.TreeSequence.ltrim"), [`rtrim()`](#tskit.TreeSequence.rtrim "tskit.TreeSequence.rtrim"), and
        [missing data](data-model.html#sec-data-model-missing-data).

        Parameters:
        :   - **intervals** (*array\_like*) – A list (start, end) pairs describing the
              genomic intervals to keep. Intervals must be non-overlapping and
              in increasing order. The list of intervals must be interpretable as a
              2D numpy array with shape (N, 2), where N is the number of intervals.
            - **simplify** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, return a simplified tree sequence where nodes
              no longer used are discarded. (Default: True).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
              provenance information of the returned tree sequence.
              (Default: True).

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

    ltrim(*record\_provenance=True*)[[source]](_modules/tskit/trees.html#TreeSequence.ltrim)[#](#tskit.TreeSequence.ltrim "Link to this definition")
    :   Returns a copy of this tree sequence with a potentially changed coordinate
        system, such that empty regions (i.e., those not covered by any edge) at the
        start of the tree sequence are trimmed away, and the leftmost edge starts at
        position 0. This affects the reported position of sites and
        edges. Additionally, sites and their associated mutations to the left of
        the new zero point are thrown away.

        Parameters:
        :   **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
            provenance information of the returned tree sequence. (Default: True).

    rtrim(*record\_provenance=True*)[[source]](_modules/tskit/trees.html#TreeSequence.rtrim)[#](#tskit.TreeSequence.rtrim "Link to this definition")
    :   Returns a copy of this tree sequence with the `sequence_length` property reset
        so that the sequence ends at the end of the rightmost edge. Additionally, sites
        and their associated mutations at positions greater than the new
        `sequence_length` are thrown away.

        Parameters:
        :   **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
            provenance information of the returned tree sequence. (Default: True).

    trim(*record\_provenance=True*)[[source]](_modules/tskit/trees.html#TreeSequence.trim)[#](#tskit.TreeSequence.trim "Link to this definition")
    :   Returns a copy of this tree sequence with any empty regions (i.e., those not
        covered by any edge) on the right and left trimmed away. This may reset both the
        coordinate system and the `sequence_length` property. It is functionally
        equivalent to [`rtrim()`](#tskit.TreeSequence.rtrim "tskit.TreeSequence.rtrim") followed by [`ltrim()`](#tskit.TreeSequence.ltrim "tskit.TreeSequence.ltrim"). Sites and their
        associated mutations in the empty regions are thrown away.

        Parameters:
        :   **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, add details of this operation to the
            provenance information of the returned tree sequence. (Default: True).

    shift(*value*, *sequence\_length=None*, *record\_provenance=True*)[[source]](_modules/tskit/trees.html#TreeSequence.shift)[#](#tskit.TreeSequence.shift "Link to this definition")
    :   Shift the coordinate system (used by edges and sites) of this TableCollection by
        a given value. Positive values shift the coordinate system to the right, negative
        values to the left. The sequence length of the tree sequence will be changed by
        `value`, unless `sequence_length` is given, in which case this will be used
        for the new sequence length.

        Note

        By setting `value=0`, this method will simply return a tree sequence
        with a new sequence length.

        Parameters:
        :   - **value** – The amount by which to shift the coordinate system.
            - **sequence\_length** – The new sequence length of the tree sequence. If
              `None` (default) add `value` to the sequence length.

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If the new coordinate system is invalid (e.g., if
            shifting the coordinate system results in negative coordinates).

    concatenate(*\*args*, *node\_mappings=None*, *record\_provenance=True*, *add\_populations=None*)[[source]](_modules/tskit/trees.html#TreeSequence.concatenate)[#](#tskit.TreeSequence.concatenate "Link to this definition")
    :   Concatenate a set of tree sequences to the right of this one, by shifting
        their coordinate systems and adding all edges, sites, mutations, and
        any additional nodes, individuals, or populations needed for these.
        Concretely, to concatenate an `other` tree sequence to `self`, the value
        of `self.sequence_length` is added to all genomic coordinates in `other`,
        and then the concatenated tree sequence will contain all edges, sites, and
        mutations in both. Which nodes in `other` are treated as “new”, and hence
        added as well, is controlled by `node_mappings`. Any individuals to which
        new nodes belong are added as well.

        The method uses [`shift()`](#tskit.TreeSequence.shift "tskit.TreeSequence.shift") followed by [`union()`](#tskit.TreeSequence.union "tskit.TreeSequence.union"), with
        `all_mutations=True`, `all_edges=True`, and `check_shared_equality=False`.

        By default, the samples in current and input tree sequences are assumed to
        refer to the same nodes, and are matched based on the numerical order of
        sample node IDs; all other nodes are assumed to be new. This can be
        changed by providing explicit `node_mappings` for each input tree sequence
        (see below).

        Note

        To add gaps between the concatenated tree sequences, use [`shift()`](#tskit.TreeSequence.shift "tskit.TreeSequence.shift")
        or to remove gaps, use [`trim()`](#tskit.TreeSequence.trim "tskit.TreeSequence.trim") before concatenating.

        Parameters:
        :   - **\*args** ([*TreeSequence*](#tskit.TreeSequence "tskit.TreeSequence")) – A list of other tree sequences to append to
              the right of this one.
            - **node\_mappings** (*Union**[*[*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*,* *None**]*) – A list of node mappings for each
              input tree sequence in `args`. Each should either be an array of
              integers of the same length as the number of nodes in the equivalent
              input tree sequence (see [`union()`](#tskit.TreeSequence.union "tskit.TreeSequence.union") for details), or
              `None`. If `None`, only sample nodes are mapped to each other.
              Default: `None`, treated as `[None] * len(args)`.
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True (default), record details of this
              call to `concatenate` in the returned tree sequence’s provenance
              information (Default: True).
            - **add\_populations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True (default), nodes new to `self` will
              be assigned new population IDs (see [`union()`](#tskit.TreeSequence.union "tskit.TreeSequence.union"))

    split\_edges(*time*, *\**, *flags=None*, *population=None*, *metadata=None*)[[source]](_modules/tskit/trees.html#TreeSequence.split_edges)[#](#tskit.TreeSequence.split_edges "Link to this definition")
    :   Returns a copy of this tree sequence in which we replace any
        edge `(left, right, parent, child)` in which
        `node_time[child] < time < node_time[parent]` with two edges
        `(left, right, parent, u)` and `(left, right, u, child)`,
        where `u` is a newly added node for each intersecting edge.

        If `metadata`, `flags`, or `population` are specified, newly
        added nodes will be assigned these values. Otherwise, default values
        will be used. The default metadata is an empty dictionary if a metadata
        schema is defined for the node table, and is an empty byte string
        otherwise. The default population for the new node is
        [`tskit.NULL`](#tskit.NULL "tskit.NULL"). Newly added have a default `flags` value of 0.

        Any metadata associated with a split edge will be copied to the new edge.

        Warning

        This method currently does not support migrations
        and a error will be raised if the migration table is not
        empty. Future versions may take migrations that intersect with the
        edge into account when determining the default population
        assignments for new nodes.

        Any mutations lying on the edge whose time is >= `time` will have
        their node value set to `u`. Note that the time of the mutation is
        defined as the time of the child node if the mutation’s time is
        unknown.

        Parameters:
        :   - **time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The cutoff time.
            - **flags** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The flags value for newly-inserted nodes. (Default = 0)
            - **population** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The population value for newly inserted nodes.
              Defaults to `tskit.NULL` if not specified.
            - **metadata** – The metadata for any newly inserted nodes. See
              [`NodeTable.add_row()`](#tskit.NodeTable.add_row "tskit.NodeTable.add_row") for details on how default metadata
              is produced for a given schema (or none).

        Returns:
        :   A copy of this tree sequence with edges split at the specified time.

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

    decapitate(*time*, *\**, *flags=None*, *population=None*, *metadata=None*)[[source]](_modules/tskit/trees.html#TreeSequence.decapitate)[#](#tskit.TreeSequence.decapitate "Link to this definition")
    :   Delete all edge topology and mutational information at least as old
        as the specified time from this tree sequence.

        Removes all edges in which the time of the child is >= the specified
        time `t`, and breaks edges that intersect with `t`. For each edge
        intersecting with `t` we create a new node with time equal to `t`,
        and set the parent of the edge to this new node. The node table
        is not altered in any other way. Newly added nodes have values
        for `flags`, `population` and `metadata` controlled by parameters
        to this function in the same way as [`split_edges()`](#tskit.TreeSequence.split_edges "tskit.TreeSequence.split_edges").

        Note

        Note that each edge is treated independently, so that even if two
        edges that are broken by this operation share the same parent and
        child nodes, there will be two different new parent nodes inserted.

        Any mutation whose time is >= `t` will be removed. A mutation’s time
        is its associated `time` value, or the time of its node if the
        mutation’s time was marked as unknown ([`UNKNOWN_TIME`](#tskit.UNKNOWN_TIME "tskit.UNKNOWN_TIME")).

        Migrations are not supported, and a LibraryError will be raised if
        called on a tree sequence containing migration information.

        See also

        This method is implemented using the [`split_edges()`](#tskit.TreeSequence.split_edges "tskit.TreeSequence.split_edges")
        and [`TableCollection.delete_older()`](#tskit.TableCollection.delete_older "tskit.TableCollection.delete_older") functions.

        Parameters:
        :   - **time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The cutoff time.
            - **flags** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The flags value for newly-inserted nodes. (Default = 0)
            - **population** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The population value for newly inserted nodes.
              Defaults to `tskit.NULL` if not specified.
            - **metadata** – The metadata for any newly inserted nodes. See
              [`NodeTable.add_row()`](#tskit.NodeTable.add_row "tskit.NodeTable.add_row") for details on how default metadata
              is produced for a given schema (or none).

        Returns:
        :   A copy of this tree sequence with edges split at the specified time.

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

    extend\_haplotypes(*max\_iter=10*)[[source]](_modules/tskit/trees.html#TreeSequence.extend_haplotypes)[#](#tskit.TreeSequence.extend_haplotypes "Link to this definition")
    :   Returns a new tree sequence in which the span covered by ancestral nodes
        is “extended” to regions of the genome according to the following rule:
        If an ancestral segment corresponding to node n has ancestor p and
        descendant c on some portion of the genome, and on an adjacent segment of
        genome p is still an ancestor of c, then n is inserted into the
        path from p to c. For instance, if p is the parent of n and n
        is the parent of c, then the span of the edges from p to n and
        n to c are extended, and the span of the edge from p to c is
        reduced. Thus, the ancestral haplotype represented by n is extended
        to a longer span of the genome. However, any edges whose child node is
        a sample are not modified. See
        [Fritze et al. (2025)](https://doi.org/10.1093/genetics/iyaf198)
        for more details.

        Since some edges may be removed entirely, this process usually reduces
        the number of edges in the tree sequence.

        The method works by iterating over the genome to look for paths that can
        be extended in this way; the maximum number of such iterations is
        controlled by `max_iter`.

        The rationale is that we know that n carries a portion of the segment
        of ancestral genome inherited by c from p, and so likely carries
        the *entire* inherited segment (since the implication otherwise would
        be that distinct recombined segments were passed down separately from
        p to c).

        In the example above, if there was a mutation on the node above c
        older than the time of n in the span into which n was extended,
        then the mutation will now occur above n. So, this operation may change
        mutations’ nodes (but will not affect genotypes). This is only
        unambiguous if the mutation’s time is known, so the method requires
        known mutation times. See [`impute_unknown_mutations_time()`](#tskit.TreeSequence.impute_unknown_mutations_time "tskit.TreeSequence.impute_unknown_mutations_time") if
        mutation times are not known.

        Note

        The method will not affect the marginal trees (so, if the original tree
        sequence was simplified, then following up with simplify will recover
        the original tree sequence, possibly with edges in a different order).
        It will also not affect the genotype matrix, or any of the tables other
        than the edge table or the node column in the mutation table.

        Parameters:
        :   **max\_iter** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The maximum number of iterations over the tree
            sequence. Defaults to 10.

        Returns:
        :   A new tree sequence with unary nodes extended.

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

    subset(*nodes*, *record\_provenance=True*, *reorder\_populations=True*, *remove\_unreferenced=True*)[[source]](_modules/tskit/trees.html#TreeSequence.subset)[#](#tskit.TreeSequence.subset "Link to this definition")
    :   Returns a tree sequence containing only information directly
        referencing the provided list of nodes to retain. The result will
        retain only the nodes whose IDs are listed in `nodes`, only edges for
        which both parent and child are in `` nodes` ``, only mutations whose
        node is in `nodes`, and only individuals that are referred to by one
        of the retained nodes. Note that this does *not* retain
        the ancestry of these nodes - for that, see [`simplify()`](#tskit.TreeSequence.simplify "tskit.TreeSequence.simplify").

        This has the side effect that it may change the order of the nodes,
        individuals, populations, and migrations in the tree sequence: the nodes
        in the new tree sequence will be in the order provided in `nodes`, and
        both individuals and populations will be ordered by the earliest retained
        node that refers to them. (However, `reorder_populations` may be set to
        False to keep the population table unchanged.)

        By default, the method removes all individuals and populations not
        referenced by any nodes, and all sites not referenced by any mutations.
        To retain these unreferenced individuals, populations, and sites, pass
        `remove_unreferenced=False`. If this is done, the site table will
        remain unchanged, unreferenced individuals will appear at the end of
        the individuals table (and in their original order), and unreferenced
        populations will appear at the end of the population table (unless
        `reorder_populations=False`).

        See also

        [`keep_intervals()`](#tskit.TreeSequence.keep_intervals "tskit.TreeSequence.keep_intervals") for subsetting a given portion of the genome;
        [`simplify()`](#tskit.TreeSequence.simplify "tskit.TreeSequence.simplify") for retaining the ancestry of a subset of nodes.

        Parameters:
        :   - **nodes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – The list of nodes for which to retain information. This
              may be a numpy array (or array-like) object (dtype=np.int32).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to record a provenance entry
              in the provenance table for this operation.
            - **reorder\_populations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to reorder populations
              (default: True). If False, the population table will not be altered in
              any way.
            - **remove\_unreferenced** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether sites, individuals, and populations
              that are not referred to by any retained entries in the tables should
              be removed (default: True). See the description for details.

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

    union(*other*, *node\_mapping*, *check\_shared\_equality=True*, *add\_populations=True*, *record\_provenance=True*, *\**, *all\_edges=False*, *all\_mutations=False*)[[source]](_modules/tskit/trees.html#TreeSequence.union)[#](#tskit.TreeSequence.union "Link to this definition")
    :   Returns an expanded tree sequence which contains the node-wise union of
        `self` and `other`, obtained by adding the non-shared portions of
        `other` onto `self`. The “shared” portions are specified using a
        map that specifies which nodes in `other` are equivalent to those in
        `self`: the `node_mapping` argument should be an array of length
        equal to the number of nodes in `other` and whose entries are the ID
        of the matching node in `self`, or `tskit.NULL` if there is no
        matching node. Those nodes in `other` that map to `tskit.NULL` will
        be added to `self`, along with:

        1. Individuals whose nodes are new to `self`.
        2. Edges whose parent or child are new to `self`.
        3. Mutations whose nodes are new to `self`.
        4. Sites whose positions are not present in the site positions in
           `self`, if the site contains a newly added mutation.

        This can be thought of as a “node-wise” union: for instance, it can not
        be used to add new edges between two nodes already in `self` or new
        mutations above nodes already in `self`.

        By default, with `add_populations=True`, populations of all newly added
        nodes are assumed to be new populations, and added to the end of the
        population table as well. This is appropriate if all nodes to be added
        are from distinct populations not already in `self` and ordering of
        populations is not important. On the other hand, if
        `add_populations=False` then no new populations are added, so any
        populations referred to in `other` must already exist in `self`.
        If some new nodes are in populations already in `self` but other new
        nodes are in entirely new populations, then you must set up the
        population table first, and then union with `add_populations=False`.

        This method makes sense if the “shared” portions of the tree sequences
        are equal; the option `check_shared_equality` performs a consistency
        check that this is true. If this check is disabled, it is very easy to
        produce nonsensical results via subtle inconsistencies.

        The behavior above can be changed by `all_edges` and `all_mutations`.
        If `all_edges` is True, then all edges in `other` are added to
        `self`, instead of only edges adjacent to added nodes. If
        `all_mutations` is True, then similarly all mutations in `other`
        are added (not just those on added nodes); furthermore, all sites
        at positions without a site already present are added to `self`.
        The intended use case for these options is a “disjoint” union,
        where for instance the two tree sequences contain information about
        disjoint segments of the genome (see [`concatenate()`](#tskit.TreeSequence.concatenate "tskit.TreeSequence.concatenate")).
        For some such applications it may be necessary to set
        `check_shared_equality=False`: for instance, if `other` has
        an identical copy of the node table but no edges, then
        `all_mutations=True, check_shared_equality=False` can be used
        to add mutations to `self`.

        Warning

        If an equivalent node is specified in `other`, the
        version in `self` is used without checking the node
        properties are the same. Similarly, if the same site position
        is present in both `self` and `other`, the version in
        `self` is used without checking that site properties are
        the same. In these cases metadata and e.g. node times or ancestral
        states in `other` are simply ignored.

        Note

        This operation also sorts the resulting tables, so the resulting
        tree sequence may not be equal to `self` even if nothing new
        was added (although it would differ only in ordering of the tables).

        Parameters:
        :   - **other** ([*TreeSequence*](#tskit.TreeSequence "tskit.TreeSequence")) – Another tree sequence.
            - **node\_mapping** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An array of node IDs that relate nodes in
              `other` to nodes in `self`.
            - **all\_edges** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, then all edges in `other` are added
              to `self`.
            - **all\_mutations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, then all mutations and sites in
              `other` are added to `self`.
            - **check\_shared\_equality** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the shared portions of the
              tree sequences will be checked for equality. It does so by
              running [`TreeSequence.subset()`](#tskit.TreeSequence.subset "tskit.TreeSequence.subset") on both `self` and `other`
              for the equivalent nodes specified in `node_mapping`, and then
              checking for equality of the subsets.
            - **add\_populations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, nodes new to `self` will be
              assigned new population IDs.
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to record a provenance entry
              in the provenance table for this operation.

        Returns:
        :   The union of the two tree sequences.

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

        Raises:
        :   **tskit.LibraryError** – If the resulting tree sequence is invalid
            (for instance, a node is specified to have two distinct
            parents on the same interval)

    draw\_svg(*path=None*, *\**, *size=None*, *x\_scale=None*, *time\_scale=None*, *tree\_height\_scale=None*, *title=None*, *node\_labels=None*, *mutation\_labels=None*, *node\_titles=None*, *mutation\_titles=None*, *root\_svg\_attributes=None*, *style=None*, *order=None*, *force\_root\_branch=None*, *symbol\_size=None*, *x\_axis=None*, *x\_label=None*, *x\_lim=None*, *x\_regions=None*, *y\_axis=None*, *y\_label=None*, *y\_ticks=None*, *y\_gridlines=None*, *omit\_sites=None*, *canvas\_size=None*, *max\_num\_trees=None*, *preamble=None*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.draw_svg)[#](#tskit.TreeSequence.draw_svg "Link to this definition")
    :   Return an SVG representation of a tree sequence. See the
        [visualization tutorial](https://tskit.dev/tutorials/viz.html#sec-tskit-viz "(in Project name not set)") for more details.

        Parameters:
        :   - **path** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The path to the file to write the output. If None, do not write
              to file.
            - **size** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*)*) – A tuple of (width, height) specifying a target
              drawing size in abstract user units (usually interpreted as pixels on
              initial display). Components of the drawing will be scaled so that the total
              plot including labels etc. normally fits onto a canvas of this size (see
              `canvas_size` below). If `None`, chose values such that each tree is
              drawn at a size appropriate for a reasonably small set of samples (this will
              nevertheless result in a very wide drawing if there are many trees to
              display). Default: `None`
            - **x\_scale** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Control how the X axis is drawn. If “physical” (the default)
              the axis scales linearly with physical distance along the sequence,
              background shading is used to indicate the position of the trees along the
              X axis, and sites (with associated mutations) are marked at the
              appropriate physical position on axis line. If “treewise”, each axis tick
              corresponds to a tree boundary, which are positioned evenly along the axis,
              so that the X axis is of variable scale, no background scaling is required,
              and site positions are not marked on the axis.
            - **time\_scale** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Control how height values for nodes are computed.
              If this is equal to `"time"`, node heights are proportional to their time
              values (this is the default). If this is equal to `"log_time"`, node
              heights are proportional to their log(time) values. If it is equal to
              `"rank"`, node heights are spaced equally according to their ranked times.
            - **tree\_height\_scale** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Deprecated alias for time\_scale. (Deprecated in
              0.3.6)
            - **title** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A title string to be included in the SVG output. If `None`
              (default) no title is shown, which gives more vertical space for the tree.
            - **node\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – If specified, show custom labels for the nodes
              (specified by ID) that are present in this map; any nodes not present will
              not have a label.
            - **mutation\_labels** – If specified, show custom labels for the
              mutations (specified by ID) that are present in the map; any mutations
              not present will not have a label.
            - **node\_titles** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – If specified, add a `<title>` string to
              symbols for each node (specified by ID) present in this map. SVG visualizers
              such as web browsers will commonly display this string on mousing over
              node symbol.
            - **mutation\_titles** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – If specified, add a `<title>` string to
              symbols for each mutation (specified by ID) present in this map. SVG
              visualizers such as web browsers will commonly display this string on
              mousing over the mutation symbol in the tree and (if show) on the x axis.
            - **root\_svg\_attributes** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – Additional attributes, such as an id, that will
              be embedded in the root `<svg>` tag of the generated drawing.
            - **style** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A [css string](https://www.w3.org/TR/CSS21/syndata.htm)
              that will be included in the `<style>` tag of the generated svg.
            - **order** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The left-to-right ordering of child nodes in each drawn tree.
              This can be either: `"minlex"`, which minimises the differences
              between adjacent trees (see also the `"minlex_postorder"` traversal
              order for the [`Tree.nodes()`](#tskit.Tree.nodes "tskit.Tree.nodes") method); or `"tree"` which draws trees
              in the left-to-right order defined by the
              [quintuply linked tree structure](data-model.html#sec-data-model-tree-structure).
              If not specified or None, this defaults to `"minlex"`.
            - **force\_root\_branch** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True` plot a branch (edge) above every tree
              root in the tree sequence. If `None` (default) then only plot such
              root branches if any root in the tree sequence has a mutation above it.
            - **symbol\_size** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – Change the default size of the node and mutation
              plotting symbols. If `None` (default) use a standard size.
            - **x\_axis** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Should the plot have an X axis line, showing the positions
              of trees along the genome. The scale used is determined by the `x_scale`
              parameter. If `None` (default) plot an X axis.
            - **x\_label** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Place a label under the plot. If `None` (default) and
              there is an X axis, create and place an appropriate label.
            - **x\_lim** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of size two giving the genomic positions between which
              trees should be plotted. If the first is `None`, then plot from the first
              non-empty region of the tree sequence. If the second is `None`, then plot
              up to the end of the last non-empty region of the tree sequence. The default
              value `x_lim=None` is shorthand for the list [`None`, `None`]. If
              numerical values are given, then regions outside the interval have all
              information discarded: this means that mutations outside the interval will
              not be shown. To force display of the entire tree sequence, including empty
              flanking regions, specify `x_lim=[0, ts.sequence_length]`.
            - **x\_regions** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – A dictionary mapping (left, right) tuples to names. This
              draws a box, labelled with the name, on the X axis between the left and
              right positions, and can be used for annotating genomic regions (e.g.
              genes) on the X axis. If `None` (default) do not plot any regions.
            - **y\_axis** (*Union**[*[*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")*,* [*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*]*) – Should the plot have an Y axis line, showing
              time. If `False` do not plot a Y axis. If `True`, plot the Y axis on
              left hand side of the plot. Can also take the strings `"left"` or
              `"right"`, specifying the side of the plot on which to plot the Y axis.
              Default: `None`, treated as `False`.
            - **y\_label** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – Place a label to the left of the plot. If `None` (default)
              and there is a Y axis, create and place an appropriate label.
            - **y\_ticks** (*Union**[*[*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*,* [*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")*]*) – A list of Y values at which to plot
              tickmarks, or a dictionary mapping Y values to labels (`[]` gives no
              tickmarks). If `None` (default), plot one tickmark for each unique node
              value. Note that if `time_scale="rank"`, the Y values refer to the
              zero-based rank of the plotted nodes, rather than the node time itself.
            - **y\_gridlines** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to plot horizontal lines behind the tree
              at each y tickmark.
            - **omit\_sites** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, omit sites and mutations from the drawing.
              Default: False
            - **canvas\_size** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")*(*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*,* [*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*)*) – The (width, height) of the SVG canvas.
              This will change the SVG width and height without rescaling graphical
              elements, allowing extra room e.g. for unusually long labels. If `None`
              take the canvas size to be the same as the target drawing size (see
              `size`, above). Default: None
            - **max\_num\_trees** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The maximum number of trees to plot. If there are
              more trees than this in the tree sequence, the middle trees will be skipped
              from the plot and a message “XX trees skipped” displayed in their place.
              If `None`, all the trees will be plotted: this can produce a very wide
              plot if there are many trees in the tree sequence. Default: None
            - **preamble** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – SVG commands to be included at the start of the returned
              object, immediately after the opening tag. These can include custom svg
              elements such as legends or annotations or even entire `<svg>` elements.
              The preamble is not checked for validity, so it is up to the user to
              ensure that it is valid SVG. Default: None

        Returns:
        :   An SVG representation of a tree sequence.

        Return type:
        :   [SVGString](#tskit.SVGString "tskit.SVGString")

        Note

        Technically, x\_lim[0] specifies a *minimum* value for the start of the X
        axis, and x\_lim[1] specifies a *maximum* value for the end. This is only
        relevant if the tree sequence contains “empty” regions with no edges or
        mutations. In this case if x\_lim[0] lies strictly within an empty region
        (i.e., `empty_tree.interval.left < x_lim[0] < empty_tree.interval.right`)
        then that tree will not be plotted on the left hand side, and the X axis
        will start at `empty_tree.interval.right`. Similarly, if x\_lim[1] lies
        strictly within an empty region then that tree will not be plotted on the
        right hand side, and the X axis will end at `empty_tree.interval.left`

    draw\_text(*\**, *node\_labels=None*, *use\_ascii=False*, *time\_label\_format=None*, *position\_label\_format=None*, *order=None*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.draw_text)[#](#tskit.TreeSequence.draw_text "Link to this definition")
    :   Create a text representation of a tree sequence.

        Parameters:
        :   - **node\_labels** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – If specified, show custom labels for the nodes
              that are present in the map. Any nodes not specified in the map will
              not have a node label.
            - **use\_ascii** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `False` (default) then use unicode
              [box drawing characters](https://en.wikipedia.org/wiki/Box-drawing_character)
              to render the tree. If `True`, use plain ascii characters, which look
              cruder but are less susceptible to misalignment or font substitution.
              Alternatively, if you are having alignment problems with Unicode, you can try
              out the solution documented [here](https://github.com/tskit-dev/tskit/issues/189#issuecomment-499114811).
            - **time\_label\_format** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A python format string specifying the format (e.g.
              number of decimal places or significant figures) used to print the numerical
              time values on the time axis. If `None`, this defaults to `"{:.2f}"`.
            - **position\_label\_format** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A python format string specifying the format
              (e.g. number of decimal places or significant figures) used to print genomic
              positions. If `None`, this defaults to `"{:.2f}"`.
            - **order** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The left-to-right ordering of child nodes in the drawn tree.
              This can be either: `"minlex"`, which minimises the differences
              between adjacent trees (see also the `"minlex_postorder"` traversal
              order for the [`Tree.nodes()`](#tskit.Tree.nodes "tskit.Tree.nodes") method); or `"tree"` which draws trees
              in the left-to-right order defined by the
              [quintuply linked tree structure](data-model.html#sec-data-model-tree-structure).
              If not specified or None, this defaults to `"minlex"`.

        Returns:
        :   A text representation of a tree sequence.

        Return type:
        :   [str](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")

    general\_stat(*W*, *f*, *output\_dim*, *windows=None*, *polarised=False*, *mode=None*, *span\_normalise=True*, *strict=True*)[[source]](_modules/tskit/trees.html#TreeSequence.general_stat)[#](#tskit.TreeSequence.general_stat "Link to this definition")
    :   Compute a windowed statistic from weights and a summary function.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).
        On each tree, this
        propagates the weights `W` up the tree, so that the “weight” of each
        node is the sum of the weights of all samples at or below the node.
        Then the summary function `f` is applied to the weights, giving a
        summary for each node in each tree. How this is then aggregated depends
        on `mode`:

        “site”
        :   Adds together the total summary value across all alleles in each window.

        “branch”
        :   Adds together the summary value for each node, multiplied by the
            length of the branch above the node and the span of the tree.

        “node”
        :   Returns each node’s summary value added across trees and multiplied
            by the span of the tree.

        Both the weights and the summary can be multidimensional: if `W` has `k`
        columns, and `f` takes a `k`-vector and returns an `m`-vector,
        then the output will be `m`-dimensional for each node or window (depending
        on “mode”).

        Note

        The summary function `f` should return zero when given both 0 and
        the total weight (i.e., `f(0) = 0` and `f(np.sum(W, axis=0)) = 0`),
        unless `strict=False`. This is necessary for the statistic to be
        unaffected by parts of the tree sequence ancestral to none or all
        of the samples, respectively.

        Parameters:
        :   - **W** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – An array of values with one row for each sample and one
              column for each weight.
            - **f** – A function that takes a one-dimensional array of length
              equal to the number of columns of `W` and returns a one-dimensional
              array.
            - **output\_dim** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The length of `f`’s return value.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **polarised** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to leave the ancestral state out of computations:
              see [Statistics](stats.html#sec-stats) for more details.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).
            - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to check that f(0) and f(total weight) are zero.

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).

    sample\_count\_stat(*sample\_sets*, *f*, *output\_dim*, *windows=None*, *polarised=False*, *mode=None*, *span\_normalise=True*, *strict=True*)[[source]](_modules/tskit/trees.html#TreeSequence.sample_count_stat)[#](#tskit.TreeSequence.sample_count_stat "Link to this definition")
    :   Compute a windowed statistic from sample counts and a summary function.
        This is a wrapper around [`general_stat()`](#tskit.TreeSequence.general_stat "tskit.TreeSequence.general_stat") for the common case in
        which the weights are all either 1 or 0, i.e., functions of the joint
        allele frequency spectrum.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [sample sets](stats.html#sec-stats-sample-sets),
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).
        If `sample_sets` is a list of `k` sets of samples, then
        `f` should be a function that takes an argument of length `k` and
        returns a one-dimensional array. The `j`-th element of the argument
        to `f` will be the number of samples in `sample_sets[j]` that lie
        below the node that `f` is being evaluated for. See
        [`general_stat()`](#tskit.TreeSequence.general_stat "tskit.TreeSequence.general_stat") for more details.

        Here is a contrived example: suppose that `A` and `B` are two sets
        of samples with `nA` and `nB` elements, respectively. Passing these
        as sample sets will give `f` an argument of length two, giving the number
        of samples in `A` and `B` below the node in question. So, if we define

        ```python
        def f(x):
            pA = x[0] / nA
            pB = x[1] / nB
            return np.array([pA * pB])
        ```

        then if all sites are biallelic,

        ```python
        ts.sample_count_stat([A, B], f, 1, windows="sites", polarised=False, mode="site")
        ```

        would compute, for each site, the product of the derived allele
        frequencies in the two sample sets, in a (num sites, 1) array. If
        instead `f` returns `np.array([pA, pB, pA * pB])`, then the
        output would be a (num sites, 3) array, with the first two columns
        giving the allele frequencies in `A` and `B`, respectively.

        Note

        The summary function `f` should return zero when given both 0 and
        the sample size (i.e., `f(0) = 0` and
        `f(np.array([len(x) for x in sample_sets])) = 0`). This is
        necessary for the statistic to be unaffected by parts of the tree
        sequence ancestral to none or all of the samples, respectively.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **f** – A function that takes a one-dimensional array of length
              equal to the number of sample sets and returns a one-dimensional array.
            - **output\_dim** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The length of `f`’s return value.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **polarised** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to leave the ancestral state out of computations:
              see [Statistics](stats.html#sec-stats) for more details.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).
            - **strict** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to check that f(0) and f(total weight) are zero.

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).

    diversity(*sample\_sets=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.diversity)[#](#tskit.TreeSequence.diversity "Link to this definition")
    :   Computes mean genetic diversity (also known as “pi”) in each of the
        sets of nodes from `sample_sets`. The statistic is also known as
        “sample heterozygosity”; a common citation for the definition is
        [Nei and Li (1979)](https://doi.org/10.1073/pnas.76.10.5269)
        (equation 22), so it is sometimes called called “Nei’s pi”
        (but also sometimes “Tajima’s pi”).

        Please see the [one-way statistics](stats.html#sec-stats-sample-sets-one-way)
        section for details on how the `sample_sets` argument is interpreted
        and how it interacts with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        Note that this quantity can also be computed by the
        [`divergence`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence") method.

        What is computed depends on `mode`:

        “site”
        :   Mean pairwise genetic diversity: the average over all n choose 2 pairs of
            sample nodes, of the density of sites at
            which the two carry different alleles, per unit of chromosome length.

        “branch”
        :   Mean distance in the tree: the average across over all n choose 2 pairs of
            sample nodes and locations in the window, of the mean distance in
            the tree between the two samples (in units of time).

        “node”
        :   For each node, the proportion of genome on which the node is an ancestor to
            only one of a pair of sample nodes from the sample set, averaged
            over over all n choose 2 pairs of sample nodes.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes for which the statistic is computed. If any of the
              sample sets contain only a single node, the returned diversity will be
              NaN. If `None` (default), average over all n choose 2 pairs of distinct
              sample nodes in the tree sequence.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A numpy array whose length is equal to the number of sample sets.
            If there is one sample set and windows=None, a numpy scalar is returned.

    divergence(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.divergence)[#](#tskit.TreeSequence.divergence "Link to this definition")
    :   Computes mean genetic divergence between (and within) pairs of
        sets of nodes from `sample_sets`.
        This is the “average number of differences”, usually referred to as “dxy”;
        a common citation for this definition is Nei and Li (1979), who called it
        \(\pi\_{XY}\). Note that the mean pairwise nucleotide diversity of a
        sample set to itself (computed by passing an index of the form (j,j))
        is its [`diversity`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity") (see the note below).

        Operates on `k = 2` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        Note

        To avoid unexpected results, sample sets should be nonoverlapping,
        since comparisons of individuals to themselves are not removed when computing
        divergence between distinct sample sets. (However, specifying an index
        `(j, j)` computes the [`diversity`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity")
        of `sample_set[j]`, which removes self comparisons to provide
        an unbiased estimate.)

        What is computed depends on `mode`:

        “site”
        :   Mean pairwise genetic divergence: the average across every possible pair of
            chromosomes (one from each sample set), of the density of sites at which
            the two carry different alleles, per unit of chromosome length.

        “branch”
        :   Mean distance in the tree: the average across every possible pair of
            chromosomes (one from each sample set) and locations in the window, of
            the mean distance in the tree between the two samples (in units of time).

        “node”
        :   For each node, the proportion of genome on which the node is an ancestor to
            only one of a pair of chromosomes from the sample set, averaged
            over all possible pairs.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one pair of sample sets and windows=None, a numpy scalar is
            returned.

    divergence\_matrix(*sample\_sets=None*, *\**, *windows=None*, *num\_threads=0*, *mode=None*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.divergence_matrix)[#](#tskit.TreeSequence.divergence_matrix "Link to this definition")
    :   Finds the matrix of pairwise [`divergence()`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence") values between groups
        of sample nodes. Returns a numpy array indexed by (window,
        sample\_set, sample\_set): the [k,i,j]th value of the result gives the
        mean divergence between pairs of samples from the i-th and j-th
        sample sets in the k-th window. As for [`divergence()`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence"),
        diagonal entries are corrected so that the
        value gives the mean divergence for *distinct* samples,
        and so diagonal entries are given by the [`diversity()`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity") of that
        sample set. For this reason, if an element of sample\_sets has only
        one element, the corresponding [`diversity()`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity") will be NaN.
        However, this method will place a value of 0 in the diagonal instead of NaN
        in such cases; otherwise, this is equivalent to computing values with
        meth:.divergence`.
        However, this is (usually) more efficient than computing many
        pairwise values using the indexes argument to [`divergence()`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence"),
        so see [`divergence()`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence") for a description of what exactly is computed.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of sets of IDs of samples.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – The breakpoints of the windows (including start
              and end, so has one more entry than number of windows).
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”; the other option is “branch”).

        Returns:
        :   An array indexed by (window, sample\_set, sample\_set), or if windows is
            None, an array indexed by (sample\_set, sample\_set).

    genetic\_relatedness(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*, *polarised=True*, *proportion=True*, *centre=True*)[[source]](_modules/tskit/trees.html#TreeSequence.genetic_relatedness)[#](#tskit.TreeSequence.genetic_relatedness "Link to this definition")
    :   Computes genetic relatedness between (and within) pairs of
        sets of nodes from `sample_sets`.
        Operates on `k = 2` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        [polarised](stats.html#sec-stats-polarisation),
        and [return value](stats.html#sec-stats-output-format).

        What is computed depends on `mode`:

        “site”
        :   Frequency of pairwise allelic matches in the window between two
            sample sets relative to the rest of the sample sets. To be precise,
            let m(u,v) denote the total number of alleles shared between
            nodes u and v, and let m(I,J) be the average of m(u,v) over
            all nodes u in sample set I and v in sample set J. Let S
            and T be independently chosen sample sets. Then, for sample sets
            I and J, this computes E[m(I,J) - m(I,S) - m(J,T) + m(S,T)]
            if centre=True (the default), or E[m(I,J)] if centre=False.
            This can also be seen as the covariance of a quantitative trait
            determined by additive contributions from the genomes in each
            sample set. Let each derived allele be associated with an effect
            drawn from a N(0,1) distribution, and let the trait value of a
            sample be the sum of its allele effects. Then, this computes
            the covariance between the average trait values of two sample sets.
            For example, to compute covariance between the traits of diploid
            individuals, each sample set would be the pair of genomes of each
            individual, with the trait being the average of the two genomes.
            If `proportion=True`, this then corresponds to \(K\_{c0}\) in
            [Speed & Balding (2014)](https://www.nature.com/articles/nrg3821),
            multiplied by four (see below).

        “branch”
        :   Average area of branches in the window ancestral to pairs of samples
            in two sample sets relative to the rest of the sample sets. To be
            precise, let B(u,v) denote the total area of all branches
            ancestral to nodes u and v, and let B(I,J) be the average of
            B(u,v) over all nodes u in sample set I and v in sample set
            J. Let S and T be two independently chosen sample sets. Then
            for sample sets I and J, this computes
            E[B(I,J) - B(I,S) - B(J,T) + B(S,T)] if centre=True (the default),
            or E[B(I,J)] if centre=False.

        “node”
        :   For each node, the proportion of the window over which pairs of
            samples in two sample sets are descendants, relative to the rest of
            the sample sets. To be precise, for each node n, let N(u,v)
            denote the proportion of the window over which samples u and v
            are descendants of n, and let and let N(I,J) be the average of
            N(u,v) over all nodes u in sample set I and v in sample set
            J. Let S and T be two independently chosen sample sets. Then
            for sample sets I and J, this computes
            E[N(I,J) - N(I,S) - N(J,T) + N(S,T)] if centre=True (the default),
            or E[N(I,J)] if centre=False.

        *Note:* The default for this statistic - unlike most other statistics - is
        `polarised=True`. Using the default value `centre=True`, setting
        `polarised=False` will only multiply the result by a factor of two
        for branch-mode, or site-mode if all sites are biallelic. (With
        multiallelic sites the difference is more complicated.) The uncentred
        and unpolarised value is probably not what you are looking for: for
        instance, the unpolarised, uncentred site statistic between two samples
        counts the number of alleles inherited by both *and* the number of
        alleles inherited by neither of the two samples.

        *Note:* Some authors
        (see [Speed & Balding (2014)](https://www.nature.com/articles/nrg3821))
        compute relatedness between I and J as the total number of all pairwise
        allelic matches between I and J, rather than the frequency,
        which would define m(I,J) as the sum of m(u,v) rather than the average
        in the definition of “site” relatedness above. If every sample set is the
        samples of a \(k\)-ploid individual, this would simply multiply the
        result by \(k^2\). However, this definition would make the result not
        useful as a summary statistic of typical relatedness for larger sample
        sets.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True). Has no effect if `proportion` is True.
            - **proportion** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Defaults to True. Whether to divide the result by
              [`segregating_sites()`](#tskit.TreeSequence.segregating_sites "tskit.TreeSequence.segregating_sites"), called with the same `windows`,
              `mode`, and `span_normalise`. Note that this counts sites
              that are segregating between *any* of the samples of *any* of the
              sample sets (rather than segregating between all of the samples of
              the tree sequence).
            - **polarised** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to leave the ancestral state out of computations:
              see [Statistics](stats.html#sec-stats) for more details. Defaults to True.
            - **centre** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Defaults to True. Whether to ‘centre’ the result, as
              described above (the usual definition is centred).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one pair of sample sets and windows=None, a numpy scalar is
            returned.

    genetic\_relatedness\_matrix(*sample\_sets=None*, *\**, *windows=None*, *num\_threads=0*, *mode=None*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.genetic_relatedness_matrix)[#](#tskit.TreeSequence.genetic_relatedness_matrix "Link to this definition")
    :   Computes the full matrix of pairwise genetic relatedness values
        between (and within) pairs of sets of nodes from `sample_sets`.
        Returns a numpy array indexed by (window, sample\_set, sample\_set):
        the [k,i,j]th value of the result gives the
        genetic relatedness between pairs of samples from the i-th and j-th
        sample sets in the k-th window.
        This is (usually) more efficient than computing many pairwise
        values using the indexes argument to [`genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness").
        Specifically, this computes [`genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness") with
        `centre=True` and `proportion=False` (with caveats, see below).

        *Warning:* in some cases, this does not compute exactly the same thing as
        [`genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness"): see below for more details.

        If mode=”branch”, then the value obtained is the same as that from
        [`genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness"), using the options centre=True and
        proportion=False. The same is true if mode=”site” and all sites have
        at most one mutation.

        However, if some sites have more than one mutation, the value may differ
        from that given by [`genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness"):, although if the proportion
        of such sites is small, the difference will be small.
        The reason is that this function (for efficiency) computes relatedness
        using [`divergence_matrix()`](#tskit.TreeSequence.divergence_matrix "tskit.TreeSequence.divergence_matrix") and the following relationship.
        “Relatedness” measures the number of *shared* alleles (or branches),
        while “divergence” measures the number of *non-shared* alleles (or branches).
        Let \(T\_i\) be the total distance from sample \(i\) up to the root;
        then if \(D\_{ij}\) is the branch-mode divergence between \(i\) and
        \(j\) and \(R\_{ij}\) is the branch-mode relatedness between \(i\)
        and \(j\), then \(T\_i + T\_j = D\_{ij} + 2 R\_{ij}.\)
        So, for any samples \(I\), \(J\), \(S\), \(T\)
        (that may now be random choices),
        \(R\_{IJ}-R\_{IS}-R\_{JT}+R\_{ST} = (D\_{IJ}-D\_{IS}-D\_{JT}+D\_{ST})/ (-2)\).
        This is exactly what we want for (centered) relatedness.
        However, this relationship does not necessarily hold for mode=”site”:
        it does hold if we can treat “number of differing alleles” as distances
        on the tree, but this is not necessarily the case in the presence of
        multiple mutations.

        Another note regarding the above relationship between \(R\) and \(D\)
        is that [`divergence()`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence") of a sample set to itself does not include
        the “self” comparisons (so as to provide an unbiased estimator of a
        population quantity), while the usual definition of genetic relatedness
        *does* include such comparisons (to provide, for instance, an appropriate
        value for prospective results beginning with only a given set of
        individuals). So, diagonal entries in the relatedness matrix returned here
        are obtained from [`divergence_matrix()`](#tskit.TreeSequence.divergence_matrix "tskit.TreeSequence.divergence_matrix") after first correcting
        diagonals to include these “self” comparisons.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   An array indexed by (window, sample\_set, sample\_set), or if windows is
            None, an array indexed by (sample\_set, sample\_set).

    genetic\_relatedness\_weighted(*W*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*, *polarised=False*, *centre=True*)[[source]](_modules/tskit/trees.html#TreeSequence.genetic_relatedness_weighted)[#](#tskit.TreeSequence.genetic_relatedness_weighted "Link to this definition")
    :   Computes weighted genetic relatedness. If the \(k\) th pair of indices
        is (i, j) then the \(k\) th column of output will be
        \(\sum\_{a,b} W\_{ai} W\_{bj} C\_{ab}\),
        where \(W\) is the matrix of weights, and \(C\_{ab}\) is the
        [`genetic_relatedness`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness") between sample
        a and sample b, summing over all pairs of samples in the tree sequence.

        *Note:* the genetic relatedness matrix \(C\) here is as returned by
        [`genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness"), rather than by [`genetic_relatedness_matrix()`](#tskit.TreeSequence.genetic_relatedness_matrix "tskit.TreeSequence.genetic_relatedness_matrix")
        (see the latter’s documentation for the difference).

        Parameters:
        :   - **W** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – An array of values with one row for each sample node and
              one column for each set of weights.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None (default). Note that if
              indexes = None, then W must have exactly two columns and this is equivalent
              to indexes = [(0,1)].
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).
            - **polarised** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to leave the ancestral state out of computations:
              see [Statistics](stats.html#sec-stats) for more details. Defaults to True.
            - **centre** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Defaults to True. Whether to ‘centre’ the result, as
              described above (the usual definition is centred).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).

    genetic\_relatedness\_vector(*W*, *windows=None*, *mode='site'*, *span\_normalise=True*, *centre=True*, *nodes=None*)[[source]](_modules/tskit/trees.html#TreeSequence.genetic_relatedness_vector)[#](#tskit.TreeSequence.genetic_relatedness_vector "Link to this definition")
    :   Computes the product of the genetic relatedness matrix and a vector of weights
        (one per sample). The output is a (num windows) x (num samples) x (num weights)
        array whose \((w,i,j)\)-th element is \(\sum\_{b} W\_{bj} C\_{ib}\),
        where \(W\) is the matrix of weights, and \(C\_{ab}\) is the
        [`genetic_relatedness`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness") between sample
        a and sample b in window w, and the sum is over all samples in the tree
        sequence. Like other statistics, if windows is None, the first dimension in
        the output is dropped.

        The relatedness used here corresponds to polarised=True; no unpolarised option
        is available for this method.

        Optionally, you may provide a list of focal nodes that modifies the behavior
        as follows. If nodes is a list of n node IDs (that do not need to be
        samples), then the output will have dimension (num windows) x n x (num weights),
        and the matrix \(C\) used in the definition above is the rectangular matrix
        with \(C\_{ij}\) the relatedness between nodes[i] and samples[j]. This
        can only be used with centre=False; if relatedness between uncentred nodes
        and centred samples is desired, then simply subtract column means from W first.
        The default is nodes=None, which is equivalent to setting nodes equal to
        ts.samples().

        Parameters:
        :   - **W** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – An array of values with one row for each sample node and
              one column for each set of weights.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).
            - **centre** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to use the *centred* relatedness matrix or not:
              see [`genetic_relatedness`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness").
            - **nodes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – Optionally, a list of focal nodes as described above
              (default: None).

        Returns:
        :   A ndarray with shape equal to (num windows, num samples, num weights),
            or (num samples, num weights) if windows is None.

    pca(*num\_components*, *windows=None*, *samples=None*, *individuals=None*, *time\_windows=None*, *mode='branch'*, *centre=True*, *num\_iterations=5*, *num\_oversamples=None*, *random\_seed=None*, *range\_sketch=None*)[[source]](_modules/tskit/trees.html#TreeSequence.pca)[#](#tskit.TreeSequence.pca "Link to this definition")
    :   Performs principal component analysis (PCA) for a given set of samples or
        individuals (default: all samples). The principal components are the
        eigenvectors of the genetic relatedness matrix, which are obtained by a
        randomized singular value decomposition (rSVD) algorithm.

        Concretely, if \(M\) is the matrix of genetic relatedness values, with
        \(M\_{ij}\) the output of
        [`genetic_relatedness`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness")
        between sample \(i\) and sample \(j\), then by default this returns
        the top `num_components` eigenvectors of \(M\), so that
        `output.factors[i,k]` is the position of sample i on the k th PC.
        If `samples` or `individuals` are provided, then this does the same thing,
        except with \(M\_{ij}\) either the relatedness between `samples[i]`
        and `samples[j]` or the nodes of `individuals[i]` and `individuals[j]`,
        respectively.

        The parameters `centre` and `mode` are passed to
        [`genetic_relatedness`](#tskit.TreeSequence.genetic_relatedness "tskit.TreeSequence.genetic_relatedness");
        if `windows` are provided then PCA is carried out separately in each window.
        If `time_windows` is provided, then genetic relatedness is measured using only
        ancestral material within the given time window (see
        [`decapitate`](#tskit.TreeSequence.decapitate "tskit.TreeSequence.decapitate") for how this is defined).

        So that the method scales to large tree sequences, the underlying method
        relies on a randomized SVD algorithm, using
        [`genetic_relatedness_vector`](#tskit.TreeSequence.genetic_relatedness_vector "tskit.TreeSequence.genetic_relatedness_vector")).
        Larger values of `num_iterations` and
        `num_oversamples` should produce better approximations to the true eigenvalues,
        at the cost of greater compute times and/or memory usage. The method relies on
        constructing `range_sketch`, a low-dimensional approximation to the range
        of \(M\), so that the result of a previous call to `pca()` may be passed
        in.

        To check for convergence, compare
        `pc1 = ts.pca()` and `pc2 = ts.pca(range_sketch=pc1.range_sketch)`; the
        difference between `pc1.factors` and `pc2.factors` provides a
        diagnostic of the convergence of the algorithm (i.e., if they are close
        then it has likely converged). Alternatively, the output value of `error_bound`
        gives an approximate upper bound for the spectral norm of the difference
        between \(M\) and the projection of \(M\) into the space spanned by
        the columns of `range_sketch`.
        Algorithms are based on Algorithms 8
        and 9 in Martinsson and Tropp, <https://arxiv.org/pdf/2002.01387> .

        Parameters:
        :   - **num\_components** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Number of principal components to return.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in (default: the entire genome).
            - **samples** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – Samples to perform PCA with (default: all samples).
            - **individuals** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – Individuals to perform PCA with. Cannot specify
              both `samples` and `individuals`.
            - **time\_windows** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – The time interval on which to apply PCA:
              currently, this must be either None (default, covers all time)
              or a single interval.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of relatedness to be computed
              (defaults to “branch”; see
              [`genetic_relatedness_vector`](#tskit.TreeSequence.genetic_relatedness_vector "tskit.TreeSequence.genetic_relatedness_vector")).
            - **centre** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to centre the genetic relatedness matrix.
            - **num\_iterations** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Number of power iterations used in the range finding
              algorithm.
            - **num\_oversamples** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Number of additional test vectors (default: 10).
              Cannot specify along with range\_sketch.
            - **random\_seed** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The random seed. If this is None, a random seed will
              be automatically generated. Valid random seeds are between 1 and
              \(2^32 − 1\). Only used if range\_sketch is not provided.
            - **range\_sketch** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – Sketch matrix for each window. Default is
              randomly generated; cannot specify along with num\_oversamples.

        Returns:
        :   A [`PCAResult`](#tskit.PCAResult "tskit.PCAResult") object, containing estimated principal components,
            eigenvalues, and other information:
            the principal component loadings are in PCAResult.factors
            and the principal values are in PCAResult.eigenvalues.

    trait\_covariance(*W*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.trait_covariance)[#](#tskit.TreeSequence.trait_covariance "Link to this definition")
    :   Computes the mean squared covariances between each of the columns of `W`
        (the “phenotypes”) and inheritance along the tree sequence.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).
        Operates on all samples in the tree sequence.

        Concretely, if g is a binary vector that indicates inheritance from an allele,
        branch, or node and w is a column of W, normalised to have mean zero,
        then the covariance of g and w is \(\sum\_i g\_i w\_i\), the sum of the
        weights corresponding to entries of g that are 1. Since weights sum to
        zero, this is also equal to the sum of weights whose entries of g are 0.
        So, \(cov(g,w)^2 = ((\sum\_i g\_i w\_i)^2 + (\sum\_i (1-g\_i) w\_i)^2)/2\).

        What is computed depends on `mode`:

        “site”
        :   The sum of squared covariances between presence/absence of each allele and
            phenotypes, divided by length of the window (if `span_normalise=True`).
            This is computed as sum\_a (sum(w[a])^2 / 2), where
            w is a column of W with the average subtracted off,
            and w[a] is the sum of all entries of w corresponding to samples
            carrying allele “a”, and the first sum is over all alleles.

        “branch”
        :   The sum of squared covariances between the split induced by each branch and
            phenotypes, multiplied by branch length, averaged across trees in
            the window. This is computed as above: a branch with total weight
            w[b] below b contributes (branch length) \* w[b]^2 to the total
            value for a tree. (Since the sum of w is zero, the total weight
            below b and not below b are equal, canceling the factor of 2
            above.)

        “node”
        :   For each node, the squared covariance between the property of
            inheriting from this node and phenotypes, computed as in “branch”.

        Parameters:
        :   - **W** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – An array of values with one row for each sample and one
              column for each “phenotype”.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If windows=None and W is a single column, a numpy scalar is returned.

    trait\_correlation(*W*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.trait_correlation)[#](#tskit.TreeSequence.trait_correlation "Link to this definition")
    :   Computes the mean squared correlations between each of the columns of `W`
        (the “phenotypes”) and inheritance along the tree sequence.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).
        Operates on all samples in the tree sequence.

        This is computed as squared covariance in
        [`trait_covariance`](#tskit.TreeSequence.trait_covariance "tskit.TreeSequence.trait_covariance"),
        but divided by \(p (1-p)\), where p is the proportion of samples
        inheriting from the allele, branch, or node in question.

        What is computed depends on `mode`:

        “site”
        :   The sum of squared correlations between presence/absence of each allele and
            phenotypes, divided by length of the window (if `span_normalise=True`).
            This is computed as the
            [`trait_covariance`](#tskit.TreeSequence.trait_covariance "tskit.TreeSequence.trait_covariance")
            divided by the variance of the relevant column of W
            and by \(p \* (1 - p)\), where \(p\) is the allele frequency.

        “branch”
        :   The sum of squared correlations between the split induced by each branch and
            phenotypes, multiplied by branch length, averaged across trees in
            the window. This is computed as the
            [`trait_covariance`](#tskit.TreeSequence.trait_covariance "tskit.TreeSequence.trait_covariance"),
            divided by the variance of the column of w
            and by \(p \* (1 - p)\), where \(p\) is the proportion of
            the samples lying below the branch.

        “node”
        :   For each node, the squared correlation between the property of
            inheriting from this node and phenotypes, computed as in “branch”.

        Note that above we divide by the **sample** variance, which for a
        vector x of length n is `np.var(x) * n / (n-1)`.

        Parameters:
        :   - **W** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – An array of values with one row for each sample and one
              column for each “phenotype”. Each column must have positive standard
              deviation.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If windows=None and W is a single column, a numpy scalar is returned.

    trait\_regression(*\*args*, *\*\*kwargs*)[[source]](_modules/tskit/trees.html#TreeSequence.trait_regression)[#](#tskit.TreeSequence.trait_regression "Link to this definition")
    :   Deprecated synonym for
        [`trait_linear_model`](#tskit.TreeSequence.trait_linear_model "tskit.TreeSequence.trait_linear_model").

    trait\_linear\_model(*W*, *Z=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.trait_linear_model)[#](#tskit.TreeSequence.trait_linear_model "Link to this definition")
    :   Finds the relationship between trait and genotype after accounting for
        covariates. Concretely, for each trait w (i.e., each column of W),
        this does a least-squares fit of the linear model \(w \sim g + Z\),
        where \(g\) is inheritance in the tree sequence (e.g., genotype)
        and the columns of \(Z\) are covariates, and returns the squared
        coefficient of \(g\) in this linear model.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).
        Operates on all samples in the tree sequence.

        To do this, if g is a binary vector that indicates inheritance from an allele,
        branch, or node and w is a column of W, there are \(k\) columns of
        \(Z\), and the \(k+2\)-vector \(b\) minimises
        \(\sum\_i (w\_i - b\_0 - b\_1 g\_i - b\_2 z\_{2,i} - ... b\_{k+2} z\_{k+2,i})^2\)
        then this returns the number \(b\_1^2\). If \(g\) lies in the linear span
        of the columns of \(Z\), then \(b\_1\) is set to 0. To fit the
        linear model without covariates (only the intercept), set Z = None.

        What is computed depends on `mode`:

        “site”
        :   Computes the sum of \(b\_1^2/2\) for each allele in the window,
            as above with \(g\) indicating presence/absence of the allele,
            then divided by the length of the window if `span_normalise=True`.
            (For biallelic loci, this number is the same for both alleles, and so summing
            over each cancels the factor of two.)

        “branch”
        :   The squared coefficient \(b\_1^2\), computed for the split induced by each
            branch (i.e., with \(g\) indicating inheritance from that branch),
            multiplied by branch length and tree span, summed over all trees
            in the window, and divided by the length of the window if
            `span_normalise=True`.

        “node”
        :   For each node, the squared coefficient \(b\_1^2\), computed for
            the property of inheriting from this node, as in “branch”.

        Parameters:
        :   - **W** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – An array of values with one row for each sample and one
              column for each “phenotype”.
            - **Z** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")) – An array of values with one row for each sample and one
              column for each “covariate”, or None. Columns of Z must be linearly
              independent.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If windows=None and W is a single column, a numpy scalar is returned.

    segregating\_sites(*sample\_sets=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.segregating_sites)[#](#tskit.TreeSequence.segregating_sites "Link to this definition")
    :   Computes the density of segregating sites for each of the sets of nodes
        from `sample_sets`, and related quantities.
        Please see the [one-way statistics](stats.html#sec-stats-sample-sets-one-way)
        section for details on how the `sample_sets` argument is interpreted
        and how it interacts with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows), [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        What is computed depends on `mode`. For a sample set `A`, computes:

        “site”
        :   The sum over sites of [the number of alleles found in `A` at each site
            minus one], per unit of chromosome length.
            If all sites have at most two alleles in `A`,
            this is the density of segregating/polymorphic sites in `A`
            (since the “minus one” reduces the sum for monoallelic sites).
            For sites with more than two alleles, the sum is increased by
            one for each additional allele segregating in `A`.
            To get the **number** of segregating alleles in `A`,
            use `span_normalise=False`.

        “branch”
        :   The total length of all branches in the tree subtended by the samples in
            `A`, averaged across the window.

        “node”
        :   The proportion of the window on which the node is ancestral to some,
            but not all, of the samples in `A`.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one sample set and windows=None, a numpy scalar is returned.

    allele\_frequency\_spectrum(*sample\_sets=None*, *windows=None*, *time\_windows=None*, *mode='site'*, *span\_normalise=True*, *polarised=False*)[[source]](_modules/tskit/trees.html#TreeSequence.allele_frequency_spectrum)[#](#tskit.TreeSequence.allele_frequency_spectrum "Link to this definition")
    :   Computes the allele frequency spectrum (AFS) in windows across the genome for
        with respect to the specified `sample_sets`.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [sample sets](stats.html#sec-stats-sample-sets),
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        [polarised](stats.html#sec-stats-polarisation),
        and [return value](stats.html#sec-stats-output-format).
        and see [Allele frequency spectra](https://tskit.dev/tutorials/analysing_tree_sequences.html#sec-tutorial-afs "(in Project name not set)") for examples of how to use this method.

        Similar to other windowed stats, the first dimension in the returned array
        corresponds to windows, such that `result[i]` is the AFS in the ith
        window. The AFS in each window is a k-dimensional numpy array, where k is
        the number of input sample sets, such that `result[i, j0, j1, ...]` is the
        value associated with frequency `j0` in `sample_sets[0]`, `j1` in
        `sample_sets[1]`, etc, in window `i`. From here, we will assume that
        `afs` corresponds to the result in a single window, i.e.,
        `afs = result[i]`.

        If a single sample set is specified, the allele frequency spectrum within
        this set is returned, such that `afs[j]` is the value associated with
        frequency `j`. Thus, singletons are counted in `afs[1]`, doubletons in
        `afs[2]`, and so on. The zeroth entry counts alleles or branches not
        seen in the samples but that are polymorphic among the rest of the samples
        of the tree sequence; likewise, the last entry counts alleles fixed in
        the sample set but polymorphic in the entire set of samples. Please see
        the [Zeroth and final entries in the AFS](https://tskit.dev/tutorials/analysing_tree_sequences.html#sec-tutorial-afs-zeroth-entry "(in Project name not set)") for an illustration.

        Warning

        Please note that singletons are **not** counted in the initial
        entry in each AFS array (i.e., `afs[0]`), but in `afs[1]`.

        If `sample_sets` is None (the default), the allele frequency spectrum
        for all samples in the tree sequence is returned. For convenience, if
        there is only a single sample set, the outer list may be omitted (so that,
        unlike other statistics, `sample_sets=[0,1,2]` is equivalent to
        `sample_sets=[[0,1,2]]`).

        If more than one sample set is specified, the **joint** allele frequency
        spectrum within windows is returned. For example, if we set
        `sample_sets = [S0, S1]`, then afs[1, 2] counts the number of sites that
        are singletons within S0 and doubletons in S1. The dimensions of the
        output array will be `[num_windows] + [1 + len(S) for S in sample_sets]`.

        If `polarised` is False (the default) the AFS will be *folded*, so that
        the counts do not depend on knowing which allele is ancestral. If folded,
        the frequency spectrum for a single sample set `S` has `afs[j] = 0` for
        all `j > len(S) / 2`, so that alleles at frequency `j` and `len(S) - j`
        both add to the same entry. If there is more than one sample set, the
        returned array is “lower triangular” in a similar way. For more details,
        especially about handling of multiallelic sites, see [Allele frequency spectrum](stats.html#sec-stats-notes-afs).

        What is computed depends on `mode`:

        “site”
        :   The number of alleles at a given frequency within the specified sample
            sets for each window, per unit of sequence length. To obtain the total
            number of alleles, set `span_normalise` to False.

        “branch”
        :   The total length of branches in the trees subtended by subsets of the
            specified sample sets, per unit of sequence length. To obtain the
            total, set `span_normalise` to False.

        “node”
        :   Not supported for this method (raises a ValueError).

        For example, suppose that S0 is a list of 5 sample IDs, and S1 is
        a list of 3 other sample IDs. Then afs = ts.allele\_frequency\_spectrum([S0, S1],
        mode=”site”, span\_normalise=False) will be a 5x3 numpy array, and if
        there are six alleles that are present in only one sample of S0 but
        two samples of S1, then afs[1,2] will be equal to 6. Similarly,
        branch\_afs = ts.allele\_frequency\_spectrum([S0, S1], mode=”branch”,
        span\_normalise=False) will also be a 5x3 array, and branch\_afs[1,2]
        will be the total area (i.e., length times span) of all branches that
        are above exactly one sample of S0 and two samples of S1.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of samples to compute the joint allele frequency.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between windows
              along the genome.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A (k + 1) dimensional numpy array, where k is the number of sample
            sets specified.
            If there is one sample set and windows=None, a 1 dimensional array is
            returned.

    Tajimas\_D(*sample\_sets=None*, *windows=None*, *mode='site'*)[[source]](_modules/tskit/trees.html#TreeSequence.Tajimas_D)[#](#tskit.TreeSequence.Tajimas_D "Link to this definition")
    :   Computes Tajima’s D of sets of nodes from `sample_sets` in windows.
        Please see the [one-way statistics](stats.html#sec-stats-sample-sets-one-way)
        section for details on how the `sample_sets` argument is interpreted
        and how it interacts with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows), [mode](stats.html#sec-stats-mode),
        and [return value](stats.html#sec-stats-output-format).
        Operates on `k = 1` sample sets at a
        time. For a sample set `X` of `n` nodes, if and `T` is the mean
        number of pairwise differing sites in `X` and `S` is the number of
        sites segregating in `X` (computed with [`diversity`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity") and [`segregating sites`](#tskit.TreeSequence.segregating_sites "tskit.TreeSequence.segregating_sites"), respectively, both not span
        normalised), then Tajima’s D is

        ```python
        D = (T - S / h) / sqrt(a * S + (b / c) * S * (S - 1))
        h = 1 + 1 / 2 + ... + 1 / (n - 1)
        g = 1 + 1 / 2**2 + ... + 1 / (n - 1) ** 2
        a = (n + 1) / (3 * (n - 1) * h) - 1 / h**2
        b = 2 * (n**2 + n + 3) / (9 * n * (n - 1)) - (n + 2) / (h * n) + g / h**2
        c = h**2 + g
        ```

        What is computed for diversity and segregating sites depends on `mode`;
        see those functions for more details.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one sample set and windows=None, a numpy scalar is returned.

    Fst(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.Fst)[#](#tskit.TreeSequence.Fst "Link to this definition")
    :   Computes “windowed” Fst between pairs of sets of nodes from `sample_sets`.
        Operates on `k = 2` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        For sample sets `X` and `Y`, if `d(X, Y)` is the
        [`divergence`](#tskit.TreeSequence.divergence "tskit.TreeSequence.divergence")
        between `X` and `Y`, and `d(X)` is the
        [`diversity`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity") of `X`, then what is
        computed is

        ```python
        Fst = 1 - 2 * (d(X) + d(Y)) / (d(X) + 2 * d(X, Y) + d(Y))
        ```

        What is computed for diversity and divergence depends on `mode`;
        see those functions for more details.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one pair of sample sets and windows=None, a numpy scalar is
            returned.

    Y3(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.Y3)[#](#tskit.TreeSequence.Y3 "Link to this definition")
    :   Computes the ‘Y’ statistic between triples of sets of nodes from `sample_sets`.
        Operates on `k = 3` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        What is computed depends on `mode`. Each is an average across every
        combination of trios of samples `(a, b, c)`, one chosen from each sample set:

        “site”
        :   The average density of sites at which `a` differs from `b` and
            `c`, per unit of chromosome length.

        “branch”
        :   The average length of all branches that separate `a` from `b`
            and `c` (in units of time).

        “node”
        :   For each node, the average proportion of the window on which `a`
            inherits from that node but `b` and `c` do not, or vice-versa.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 3-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one triple of sample sets and windows=None, a numpy scalar is
            returned.

    Y2(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.Y2)[#](#tskit.TreeSequence.Y2 "Link to this definition")
    :   Computes the ‘Y2’ statistic between pairs of sets of nodes from `sample_sets`.
        Operates on `k = 2` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        What is computed depends on `mode`. Each is computed exactly as
        `Y3`, except that the average is across every possible trio of samples
        `(a, b1, b2)`, where `a` is chosen from the first sample set, and
        `b1, b2` are chosen (without replacement) from the second sample set.
        See [`Y3`](#tskit.TreeSequence.Y3 "tskit.TreeSequence.Y3") for more details.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one pair of sample sets and windows=None, a numpy scalar is
            returned.

    Y1(*sample\_sets*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.Y1)[#](#tskit.TreeSequence.Y1 "Link to this definition")
    :   Computes the ‘Y1’ statistic within each of the sets of nodes given by
        `sample_sets`.
        Please see the [one-way statistics](stats.html#sec-stats-sample-sets-one-way)
        section for details on how the `sample_sets` argument is interpreted
        and how it interacts with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows), [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).
        Operates on `k = 1` sample set at a time.

        What is computed depends on `mode`. Each is computed exactly as
        `Y3`, except that the average is across every possible trio of samples
        samples `(a1, a2, a3)` all chosen without replacement from the same
        sample set. See [`Y3`](#tskit.TreeSequence.Y3 "tskit.TreeSequence.Y3") for more details.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one sample set and windows=None, a numpy scalar is returned.

    f4(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.f4)[#](#tskit.TreeSequence.f4 "Link to this definition")
    :   Computes Patterson’s f4 statistic between four groups of nodes from
        `sample_sets`.
        Operates on `k = 4` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        What is computed depends on `mode`. Each is an average across every possible
        combination of four samples `(a, b; c, d)`, one chosen from each sample set:

        “site”
        :   The average density of sites at which `a` and `c` agree but
            differs from `b` and `d`, minus the average density of sites at
            which `a` and `d` agree but differs from `b` and `c`, per
            unit of chromosome length.

        “branch”
        :   The average length of all branches that separate `a` and `c`
            from `b` and `d`, minus the average length of all branches that
            separate `a` and `d` from `b` and `c` (in units of time).

        “node”
        :   For each node, the average proportion of the window on which `a` and `c`
            inherit from that node but `b` and `d` do not, or vice-versa,
            minus the average proportion of the window on which `a` and `d`
            inherit from that node but `b` and `c` do not, or vice-versa.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 4-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there are four sample sets and windows=None, a numpy scalar is returned.

    f3(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.f3)[#](#tskit.TreeSequence.f3 "Link to this definition")
    :   Computes Patterson’s f3 statistic between three groups of nodes from
        `sample_sets`.
        Note that the order of the arguments of f3 differs across the literature:
        here, `f3([A, B, C])` for sample sets `A`, `B`, and `C`
        will estimate
        \(f\_3(A; B, C) = \mathbb{E}[(p\_A - p\_B) (p\_A - p\_C)]\),
        where \(p\_A\) is the allele frequency in `A`.
        When used as a test for admixture, the putatively admixed population
        is usually placed as population `A` (see
        [Peter (2016)](https://doi.org/10.1534/genetics.115.183913)
        for more discussion).

        Operates on `k = 3` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        What is computed depends on `mode`. Each works exactly as
        [`f4`](#tskit.TreeSequence.f4 "tskit.TreeSequence.f4"), except the average is across every possible
        combination of four samples `(a1, b; a2, c)` where a1 and a2 have both
        been chosen (without replacement) from the first sample set. See
        [`f4`](#tskit.TreeSequence.f4 "tskit.TreeSequence.f4") for more details.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 3-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there are three sample sets and windows=None, a numpy scalar is returned.

    f2(*sample\_sets*, *indexes=None*, *windows=None*, *mode='site'*, *span\_normalise=True*)[[source]](_modules/tskit/trees.html#TreeSequence.f2)[#](#tskit.TreeSequence.f2 "Link to this definition")
    :   Computes Patterson’s f2 statistic between two groups of nodes from
        `sample_sets`.
        Operates on `k = 2` sample sets at a time; please see the
        [multi-way statistics](stats.html#sec-stats-sample-sets-multi-way)
        section for details on how the `sample_sets` and `indexes` arguments are
        interpreted and how they interact with the dimensions of the output array.
        See the [statistics interface](stats.html#sec-stats-interface) section for details on
        [windows](stats.html#sec-stats-windows),
        [mode](stats.html#sec-stats-mode),
        [span normalise](stats.html#sec-stats-span-normalise),
        and [return value](stats.html#sec-stats-output-format).

        What is computed depends on `mode`. Each works exactly as
        [`f4`](#tskit.TreeSequence.f4 "tskit.TreeSequence.f4"), except the average is across every possible
        combination of four samples `(a1, b1; a2, b2)` where a1 and a2 have
        both been chosen (without replacement) from the first sample set, and `b1`
        and `b2` have both been chosen (without replacement) from the second
        sample set. See [`f4`](#tskit.TreeSequence.f4 "tskit.TreeSequence.f4") for more details.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the windows
              to compute the statistic in.
            - **mode** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string giving the “type” of the statistic to be computed
              (defaults to “site”).
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of the
              window (defaults to True).

        Returns:
        :   A ndarray with shape equal to (num windows, num statistics).
            If there is one pair of sample sets and windows=None, a numpy scalar is
            returned.

    mean\_descendants(*sample\_sets*)[[source]](_modules/tskit/trees.html#TreeSequence.mean_descendants)[#](#tskit.TreeSequence.mean_descendants "Link to this definition")
    :   Computes for every node the mean number of samples in each of the
        sample\_sets that descend from that node, averaged over the
        portions of the genome for which the node is ancestral to *any* sample.
        The output is an array, C[node, j], which reports the total span of
        all genomes in sample\_sets[j] that inherit from node, divided by
        the total span of the genome on which node is an ancestor to any
        sample in the tree sequence.

        Warning

        The interface for this method is preliminary and may be subject to
        backwards incompatible changes in the near future. The long-term stable
        API for this method will be consistent with other [Statistics](stats.html#sec-stats).
        In particular, the normalization by proportion of the genome that node
        is an ancestor to anyone may not be the default behaviour in the future.

        Parameters:
        :   **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of node IDs.

        Returns:
        :   An array with dimensions (number of nodes in the tree sequence,
            number of reference sets)

    genealogical\_nearest\_neighbours(*focal*, *sample\_sets*, *num\_threads=0*)[[source]](_modules/tskit/trees.html#TreeSequence.genealogical_nearest_neighbours)[#](#tskit.TreeSequence.genealogical_nearest_neighbours "Link to this definition")
    :   Return the genealogical nearest neighbours (GNN) proportions for the given
        focal nodes, with reference to two or more sets of interest, averaged over all
        trees in the tree sequence.

        The GNN proportions for a focal node in a single tree are given by first finding
        the most recent common ancestral node \(a\) between the focal node and any
        other node present in the reference sets. The GNN proportion for a specific
        reference set, \(S\) is the number of nodes in \(S\) that descend from
        \(a\), as a proportion of the total number of descendant nodes in any of the
        reference sets.

        For example, consider a case with 2 sample sets, \(S\_1\) and \(S\_2\).
        For a given tree, \(a\) is the node that includes at least one descendant in
        \(S\_1\) or \(S\_2\) (not including the focal node). If the descendants of
        \(a\) include some nodes in \(S\_1\) but no nodes in \(S\_2\), then the
        GNN proportions for that tree will be 100% \(S\_1\) and 0% \(S\_2\), or
        \([1.0, 0.0]\).

        For a given focal node, the GNN proportions returned by this function are an
        average of the GNNs for each tree, weighted by the genomic distance spanned by
        that tree.

        For an precise mathematical definition of GNN, see <https://doi.org/10.1101/458067>

        Note

        The reference sets need not include all the samples, hence the most
        recent common ancestral node of the reference sets, \(a\), need not be
        the immediate ancestor of the focal node. If the reference sets only comprise
        sequences from relatively distant individuals, the GNN statistic may end up
        as a measure of comparatively distant ancestry, even for tree sequences that
        contain many closely related individuals.

        Warning

        The interface for this method is preliminary and may be subject to
        backwards incompatible changes in the near future. The long-term stable
        API for this method will be consistent with other [Statistics](stats.html#sec-stats).

        Parameters:
        :   - **focal** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of \(n\) nodes whose GNNs should be calculated.
            - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of \(m\) lists of node IDs.

        Returns:
        :   An \(n\) by \(m\) array of focal nodes by GNN proportions.
            Every focal node corresponds to a row. The numbers in each
            row corresponding to the GNN proportion for each of the passed-in reference
            sets. Rows therefore sum to one.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")

    kc\_distance(*other*, *lambda\_=0.0*)[[source]](_modules/tskit/trees.html#TreeSequence.kc_distance)[#](#tskit.TreeSequence.kc_distance "Link to this definition")
    :   Returns the average [`Tree.kc_distance()`](#tskit.Tree.kc_distance "tskit.Tree.kc_distance") between pairs of trees along
        the sequence whose intervals overlap. The average is weighted by the
        fraction of the sequence on which each pair of trees overlap.

        Parameters:
        :   - **other** ([*TreeSequence*](#tskit.TreeSequence "tskit.TreeSequence")) – The other tree sequence to compare to.
            - **lambda** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The KC metric lambda parameter determining the
              relative weight of topology and branch length.

        Returns:
        :   The computed KC distance between this tree sequence and other.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    count\_topologies(*sample\_sets=None*)[[source]](_modules/tskit/trees.html#TreeSequence.count_topologies)[#](#tskit.TreeSequence.count_topologies "Link to this definition")
    :   Returns a generator that produces the same distribution of topologies as
        [`Tree.count_topologies()`](#tskit.Tree.count_topologies "tskit.Tree.count_topologies") but sequentially for every tree in a tree
        sequence. For use on a tree sequence this method is much faster than
        computing the result independently per tree.

        Warning

        The interface for this method is preliminary and may be subject to
        backwards incompatible changes in the near future.

        Parameters:
        :   **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
            groups of nodes to compute the statistic with.

        Return type:
        :   iter([`tskit.TopologyCounter`](#tskit.TopologyCounter "tskit.TopologyCounter"))

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If nodes in `sample_sets` are invalid or are
            internal samples.

    ibd\_segments(*\**, *within=None*, *between=None*, *max\_time=None*, *min\_span=None*, *store\_pairs=None*, *store\_segments=None*)[[source]](_modules/tskit/trees.html#TreeSequence.ibd_segments)[#](#tskit.TreeSequence.ibd_segments "Link to this definition")
    :   Finds pairs of samples that are identical by descent (IBD) and returns
        the result as an [`IdentitySegments`](#tskit.IdentitySegments "tskit.IdentitySegments") instance. The information
        stored in this object is controlled by the `store_pairs` and
        `store_segments` parameters. By default only total counts and other
        statistics of the IBD segments are stored (i.e.,
        `store_pairs=False`), since storing pairs and segments has a
        substantial CPU and memory overhead. Please see the
        [Identity by descent](ibd.html#sec-identity) section for more details on how to access the
        information stored in the [`IdentitySegments`](#tskit.IdentitySegments "tskit.IdentitySegments").

        If `within` is specified, only IBD segments for pairs of nodes within
        that set will be recorded. If `between` is specified, only IBD
        segments from pairs that are in one or other of the specified sample
        sets will be reported. Note that `within` and `between` are
        mutually exclusive.

        A pair of nodes `(u, v)` has an IBD segment with a left and right
        coordinate `[left, right)` and ancestral node `a` iff the most
        recent common ancestor of the segment `[left, right)` in nodes `u`
        and `v` is `a`, and the segment has been inherited along the same
        genealogical path (ie. it has not been broken by recombination). The
        segments returned are the longest possible ones.

        Note that this definition is purely genealogical — allelic states
        *are not* considered here. If used without time or length thresholds, the
        segments returned for a given pair will partition the span of the contig
        represented by the tree sequence.

        Parameters:
        :   - **within** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of node IDs defining set of nodes that
              we finding IBD segments for. If not specified, this defaults to
              all samples in the tree sequence.
            - **between** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*]*) – A list of lists of sample node IDs. Given
              two sample sets A and B, only IBD segments will be returned such
              that one of the samples is an element of A and the other is
              an element of B. Cannot be specified with `within`.
            - **max\_time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – Only segments inherited from common
              ancestors whose node times are more recent than the specified time
              will be returned. Specifying a maximum time is strongly recommended when
              working with large tree sequences.
            - **min\_span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – Only segments in which the difference between
              the right and left genome coordinates (i.e., the span of the
              segment) is greater than this value will be included. (Default=0)
            - **store\_pairs** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True store information separately for each
              pair of samples `(a, b)` that are found to be IBD. Otherwise
              store summary information about all sample apirs. (Default=False)
            - **store\_segments** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True store each IBD segment
              `(left, right, c)` and associate it with the corresponding
              sample pair `(a, b)`. If True, implies `store_pairs`.
              (Default=False).

        Returns:
        :   An [`IdentitySegments`](#tskit.IdentitySegments "tskit.IdentitySegments") object containing the recorded
            IBD information.

        Return type:
        :   [IdentitySegments](#tskit.IdentitySegments "tskit.IdentitySegments")

    pair\_coalescence\_counts(*sample\_sets=None*, *indexes=None*, *windows=None*, *span\_normalise=True*, *pair\_normalise=False*, *time\_windows='nodes'*)[[source]](_modules/tskit/trees.html#TreeSequence.pair_coalescence_counts)[#](#tskit.TreeSequence.pair_coalescence_counts "Link to this definition")
    :   Calculate the number of coalescing sample pairs per node, summed over
        trees and weighted by tree span.

        The number of coalescing pairs may be calculated within or between the
        non-overlapping lists of samples contained in sample\_sets. In the
        latter case, pairs are counted if they have exactly one member in each
        of two sample sets. If sample\_sets is omitted, a single set
        containing all samples is assumed.

        The argument indexes may be used to specify which pairs of sample
        sets to compute the statistic between, and in what order. If
        indexes=None, then indexes is assumed to equal [(0,0)] for a
        single sample set and [(0,1)] for two sample sets. For more than two
        sample sets, indexes must be explicitly passed.

        The argument time\_windows may be used to count coalescence
        events within time intervals (if an array of breakpoints is supplied)
        rather than for individual nodes (the default).

        The output array has dimension (windows, indexes, nodes) with
        dimensions dropped when the corresponding argument is set to None.

        Parameters:
        :   - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with, or None.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the
              sequence windows to compute the statistic in, or None.
            - **span\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the span of
              non-missing sequence in the window (defaults to True).
            - **pair\_normalise** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to divide the result by the total
              number of pairs for a given index (defaults to False).
            - **time\_windows** – Either a string “nodes” or an increasing
              list of breakpoints between time intervals.

    pair\_coalescence\_quantiles(*quantiles*, *sample\_sets=None*, *indexes=None*, *windows=None*)[[source]](_modules/tskit/trees.html#TreeSequence.pair_coalescence_quantiles)[#](#tskit.TreeSequence.pair_coalescence_quantiles "Link to this definition")
    :   Estimate quantiles of pair coalescence times by inverting the empirical
        CDF. This is equivalent to the “inverted\_cdf” method of
        numpy.quantile applied to node times, with weights proportional to
        the number of coalescing pairs per node (averaged over trees, see
        TreeSequence.pair\_coalescence\_counts).

        Quantiles of pair coalescence times may be calculated within or
        between the non-overlapping lists of samples contained in sample\_sets. In
        the latter case, pairs are counted if they have exactly one member in each
        of two sample sets. If sample\_sets is omitted, a single set containing
        all samples is assumed.

        The argument indexes may be used to specify which pairs of sample sets to
        compute coalescences between, and in what order. If indexes=None, then
        indexes is assumed to equal [(0,0)] for a single sample set and
        [(0,1)] for two sample sets. For more than two sample sets, indexes
        must be explicitly passed.

        The output array has dimension (windows, indexes, quantiles) with
        dimensions dropped when the corresponding argument is set to None.

        Parameters:
        :   - **quantiles** – A list of increasing breakpoints between [0, 1].
            - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with, or None.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the
              sequence windows to compute the statistic in, or None.

    pair\_coalescence\_rates(*time\_windows*, *sample\_sets=None*, *indexes=None*, *windows=None*)[[source]](_modules/tskit/trees.html#TreeSequence.pair_coalescence_rates)[#](#tskit.TreeSequence.pair_coalescence_rates "Link to this definition")
    :   Estimate the rate at which pairs of samples coalesce within time
        windows, using the empirical cumulative distribution function (ecdf) of
        pair coalescence times. Assuming that pair coalescence events follow a
        nonhomogeneous Poisson process, the empirical rate for a time window
        \([a, b)\) where \(ecdf(b) < 1\) is,

        ..math:

        > log(1 - frac{ecdf(b) - ecdf(a)}{1 - ecdf(a)}) / (a - b)

        If the last coalescence event is within \([a, b)\), so that
        \(ecdf(b) = 1\), then an estimate of the empirical rate is

        ..math:

        > (mathbb{E}[t | t > a] - a)^{-1}

        where \(\mathbb{E}[t | t < a]\) is the average pair coalescence time
        conditional on coalescence after the start of the last epoch.

        The first breakpoint in time\_windows must start at the age of the
        samples, and the last must end at infinity. In the output array, any
        time windows where all pairs have coalesced by start of the window will
        contain NaN values.

        Pair coalescence rates may be calculated within or between the
        non-overlapping lists of samples contained in sample\_sets. In the
        latter case, pairs are counted if they have exactly one member in each
        of two sample sets. If sample\_sets is omitted, a single group
        containing all samples is assumed.

        The argument indexes may be used to specify which pairs of sample
        sets to compute the statistic between, and in what order. If
        indexes=None, then indexes is assumed to equal [(0,0)] for a
        single sample set and [(0,1)] for two sample sets. For more than two
        sample sets, indexes must be explicitly passed.

        The output array has dimension (windows, indexes, time\_windows) with
        dimensions dropped when the corresponding argument is set to None.

        Parameters:
        :   - **time\_windows** – An increasing list of breakpoints between time
              intervals, starting at the age of the samples and ending at
              infinity.
            - **sample\_sets** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of lists of Node IDs, specifying the
              groups of nodes to compute the statistic with, or None.
            - **indexes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of 2-tuples, or None.
            - **windows** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An increasing list of breakpoints between the
              sequence windows to compute the statistic in, or None.

    impute\_unknown\_mutations\_time(*method=None*)[[source]](_modules/tskit/trees.html#TreeSequence.impute_unknown_mutations_time)[#](#tskit.TreeSequence.impute_unknown_mutations_time "Link to this definition")
    :   Returns an array of mutation times, where any unknown times are
        imputed from the times of associated nodes. Not to be confused with
        [`TableCollection.compute_mutation_times()`](#tskit.TableCollection.compute_mutation_times "tskit.TableCollection.compute_mutation_times"), which modifies the
        `time` column of the mutations table in place.

        Parameters:
        :   **method** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The method used to impute the unknown mutation times.
            Currently only “min” is supported, which uses the time of the node
            below the mutation as the mutation time. The “min” method can also
            be specified by `method=None` (Default: `None`).

        Returns:
        :   An array of length equal to the number of mutations in the
            tree sequence.

    sample\_nodes\_by\_ploidy(*ploidy*)[[source]](_modules/tskit/trees.html#TreeSequence.sample_nodes_by_ploidy)[#](#tskit.TreeSequence.sample_nodes_by_ploidy "Link to this definition")
    :   Returns an 2D array of node IDs, where each row has length ploidy.
        This is useful when individuals are not defined in the tree sequence
        so TreeSequence.individuals\_nodes cannot be used. The samples are
        placed in the array in the order which they are found in the node
        table. The number of sample nodes must be a multiple of ploidy.

        Parameters:
        :   **ploidy** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of samples per individual.

        Returns:
        :   A 2D array of node IDs, where each row has length ploidy.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")

    map\_to\_vcf\_model(*individuals=None*, *ploidy=None*, *name\_metadata\_key=None*, *individual\_names=None*, *include\_non\_sample\_nodes=None*, *position\_transform=None*, *contig\_id=None*, *isolated\_as\_missing=None*)[[source]](_modules/tskit/trees.html#TreeSequence.map_to_vcf_model)[#](#tskit.TreeSequence.map_to_vcf_model "Link to this definition")
    :   Maps the sample nodes in this tree sequence to a representation suitable for
        VCF output, using the individuals if present.

        Creates a VcfModelMapping object that contains a nodes-to-individual
        mapping as a 2D array of (individuals, nodes), the individual names and VCF
        compatible site positions and contig length. The
        mapping is created by first checking if the tree sequence contains individuals.
        If it does, the mapping is created using the individuals in the tree sequence.
        By default only the sample nodes of the individuals are included in the mapping,
        unless include\_non\_sample\_nodes is set to True, in which case all nodes
        belonging to the individuals are included. Any individuals without any nodes
        will have no nodes in their row of the mapping, being essentially of zero ploidy.
        If no individuals are present, the mapping is created using only the sample nodes
        and the specified ploidy.

        As the tskit data model allows non-integer positions, site positions and contig
        length are transformed to integer values suitable for VCF output. The
        transformation is done using the position\_transform function, which must
        return an integer numpy array the same dimension as the input. By default,
        this is set to `numpy.round()` which will round values to the nearest integer.

        If neither name\_metadata\_key nor individual\_names is specified, the
        individual names are set to `"tsk_{individual_id}"` for each individual. If
        no individuals are present, the individual names are set to “tsk\_{i}” with
        0 <= i < num\_sample\_nodes/ploidy.

        A warning is emitted if any sample nodes do not have an individual ID.

        Parameters:
        :   - **individuals** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – Specific individual IDs to include in the VCF. If not
              specified and the tree sequence contains individuals, all individuals are
              included at least one node.
            - **ploidy** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ploidy, or number of nodes per individual. Only used when
              the tree sequence does not contain individuals. Cannot be used if the tree
              sequence contains individuals. Defaults to 1 if not specified.
            - **name\_metadata\_key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The key in the individual metadata to use
              for individual names. Cannot be specified simultaneously with
              individual\_names.
            - **individual\_names** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – The names to use for each individual. Cannot
              be specified simultaneously with name\_metadata\_key.
            - **include\_non\_sample\_nodes** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, include all nodes belonging to
              the individuals in the mapping. If False, only include sample nodes.
              Defaults to False.
            - **position\_transform** – A callable that transforms the
              site position values into integer valued coordinates suitable for
              VCF. The function takes a single positional parameter x and must
              return an integer numpy array the same dimension as x. By default,
              this is set to `numpy.round()` which will round values to the
              nearest integer. If the string “legacy” is provided here, the
              pre 0.2.0 legacy behaviour of rounding values to the nearest integer
              (starting from 1) and avoiding the output of identical positions
              by incrementing is used.
              See the [Modifying coordinates](export.html#sec-export-vcf-modifying-coordinates) for examples
              and more information.
            - **contig\_id** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The ID of the contig to use in the VCF output.
              Defaults to “1” if not specified.
            - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, isolated samples without mutations
              will be considered as missing data in the VCF output. If False, these samples
              will have the ancestral state in the VCF output.
              Default: True.

        Returns:
        :   A VcfModelMapping containing the node-to-individual mapping,
            individual names, transformed positions, and transformed contig length.

        Raises:
        :   [**ValueError**](https://docs.python.org/3/library/exceptions.html#ValueError "(in Python v3.14)") – If both name\_metadata\_key and individual\_names are specified,
            if ploidy is specified when individuals are present, if an invalid individual
            ID is specified, if a specified individual has no nodes, or if the number of
            individuals doesn’t match the number of names.

    pairwise\_diversity(*samples=None*)[[source]](_modules/tskit/trees.html#TreeSequence.pairwise_diversity)[#](#tskit.TreeSequence.pairwise_diversity "Link to this definition")
    :   Returns the pairwise nucleotide site diversity, the average number of sites
        that differ between a every possible pair of distinct samples. If samples is
        specified, calculate the diversity within this set.

        > Deprecated since version 0.2.0: please use [`diversity()`](#tskit.TreeSequence.diversity "tskit.TreeSequence.diversity") instead. Since version 0.2.0 the error
        > semantics have also changed slightly. It is no longer an error
        > when there is one sample and a tskit.LibraryError is raised
        > when non-sample IDs are provided rather than a ValueError. It is
        > also no longer an error to compute pairwise diversity at sites
        > with multiple mutations.

        Parameters:
        :   **samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – The set of samples within which we calculate
            the diversity. If None, calculate diversity within the entire sample.

        Returns:
        :   The pairwise nucleotide site diversity.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

### Simple container classes[#](#simple-container-classes "Link to this heading")

#### The [`Individual`](#tskit.Individual "tskit.Individual") class[#](#the-individual-class "Link to this heading")

*class* tskit.Individual[[source]](_modules/tskit/trees.html#Individual)[#](#tskit.Individual "Link to this definition")
:   An [individual](data-model.html#sec-individual-table-definition) in a tree sequence.
    Since nodes correspond to genomes, individuals are associated with a collection
    of nodes (e.g., two nodes per diploid). See [Nodes, Genomes, or Individuals?](glossary.html#sec-nodes-or-individuals)
    for more discussion of this distinction.

    Modifying the attributes in this class will have **no effect** on the
    underlying tree sequence data.

    id[#](#tskit.Individual.id "Link to this definition")
    :   The integer ID of this individual. Varies from 0 to
        [`TreeSequence.num_individuals`](#tskit.TreeSequence.num_individuals "tskit.TreeSequence.num_individuals") - 1.

    flags[#](#tskit.Individual.flags "Link to this definition")
    :   The bitwise flags for this individual.

    location[#](#tskit.Individual.location "Link to this definition")
    :   The spatial location of this individual as a numpy array. The location is an empty
        array if no spatial location is defined.

    parents[#](#tskit.Individual.parents "Link to this definition")
    :   The parent individual ids of this individual as a numpy array. The parents is an
        empty array if no parents are defined.

    nodes[#](#tskit.Individual.nodes "Link to this definition")
    :   The IDs of the nodes that are associated with this individual as
        a numpy array (dtype=np.int32). If no nodes are associated with the
        individual this array will be empty.

    metadata[#](#tskit.Individual.metadata "Link to this definition")
    :   The [metadata](data-model.html#sec-metadata-definition)
        for this individual, decoded if a schema applies.

#### The [`Node`](#tskit.Node "tskit.Node") class[#](#the-node-class "Link to this heading")

*class* tskit.Node[[source]](_modules/tskit/trees.html#Node)[#](#tskit.Node "Link to this definition")
:   A [node](data-model.html#sec-node-table-definition) in a tree sequence, corresponding
    to a single genome. The `time` and `population` are attributes of the
    `Node`, rather than the `Individual`, as discussed in
    [Nodes, Genomes, or Individuals?](glossary.html#sec-nodes-or-individuals).

    Modifying the attributes in this class will have **no effect** on the
    underlying tree sequence data.

    id[#](#tskit.Node.id "Link to this definition")
    :   The integer ID of this node. Varies from 0 to [`TreeSequence.num_nodes`](#tskit.TreeSequence.num_nodes "tskit.TreeSequence.num_nodes") - 1.

    flags[#](#tskit.Node.flags "Link to this definition")
    :   The bitwise flags for this node.

    time[#](#tskit.Node.time "Link to this definition")
    :   The birth time of this node.

    population[#](#tskit.Node.population "Link to this definition")
    :   The integer ID of the population that this node was born in.

    individual[#](#tskit.Node.individual "Link to this definition")
    :   The integer ID of the individual that this node was a part of.

    metadata[#](#tskit.Node.metadata "Link to this definition")
    :   The [metadata](data-model.html#sec-metadata-definition) for this node, decoded if a schema
        applies.

    is\_sample()[[source]](_modules/tskit/trees.html#Node.is_sample)[#](#tskit.Node.is_sample "Link to this definition")
    :   Returns True if this node is a sample. This value is derived from the
        `flag` variable.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

#### The [`Edge`](#tskit.Edge "tskit.Edge") class[#](#the-edge-class "Link to this heading")

*class* tskit.Edge[[source]](_modules/tskit/trees.html#Edge)[#](#tskit.Edge "Link to this definition")
:   An [edge](data-model.html#sec-edge-table-definition) in a tree sequence.

    Modifying the attributes in this class will have **no effect** on the
    underlying tree sequence data.

    id[#](#tskit.Edge.id "Link to this definition")
    :   The integer ID of this edge. Varies from 0 to
        [`TreeSequence.num_edges`](#tskit.TreeSequence.num_edges "tskit.TreeSequence.num_edges") - 1.

    left[#](#tskit.Edge.left "Link to this definition")
    :   The left coordinate of this edge.

    right[#](#tskit.Edge.right "Link to this definition")
    :   The right coordinate of this edge.

    parent[#](#tskit.Edge.parent "Link to this definition")
    :   The integer ID of the parent node for this edge.
        To obtain further information about a node with a given ID, use
        [`TreeSequence.node()`](#tskit.TreeSequence.node "tskit.TreeSequence.node").

    child[#](#tskit.Edge.child "Link to this definition")
    :   The integer ID of the child node for this edge.
        To obtain further information about a node with a given ID, use
        [`TreeSequence.node()`](#tskit.TreeSequence.node "tskit.TreeSequence.node").

    metadata[#](#tskit.Edge.metadata "Link to this definition")
    :   The [metadata](data-model.html#sec-metadata-definition) for this edge, decoded if a schema
        applies.

    *property* span[#](#tskit.Edge.span "Link to this definition")
    :   Returns the span of this edge, i.e., the right position minus the left position

        Returns:
        :   The span of this edge.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    *property* interval[#](#tskit.Edge.interval "Link to this definition")
    :   Returns the left and right positions of this edge as an [`Interval`](#tskit.Interval "tskit.Interval")

        Returns:
        :   The interval covered by this edge.

        Return type:
        :   [`Interval`](#tskit.Interval "tskit.Interval")

#### The [`Site`](#tskit.Site "tskit.Site") class[#](#the-site-class "Link to this heading")

*class* tskit.Site[[source]](_modules/tskit/trees.html#Site)[#](#tskit.Site "Link to this definition")
:   A [site](data-model.html#sec-site-table-definition) in a tree sequence.

    Modifying the attributes in this class will have **no effect** on the
    underlying tree sequence data.

    id[#](#tskit.Site.id "Link to this definition")
    :   The integer ID of this site. Varies from 0 to [`TreeSequence.num_sites`](#tskit.TreeSequence.num_sites "tskit.TreeSequence.num_sites") - 1.

    position[#](#tskit.Site.position "Link to this definition")
    :   The floating point location of this site in genome coordinates.
        Ranges from 0 (inclusive) to [`TreeSequence.sequence_length`](#tskit.TreeSequence.sequence_length "tskit.TreeSequence.sequence_length") (exclusive).

    ancestral\_state[#](#tskit.Site.ancestral_state "Link to this definition")
    :   The ancestral state at this site (i.e., the state inherited by nodes, unless
        mutations occur).

    mutations[#](#tskit.Site.mutations "Link to this definition")
    :   The list of mutations at this site. Mutations within a site are returned in the

        order they are specified in the underlying [`MutationTable`](#tskit.MutationTable "tskit.MutationTable"). For canonical
        (i.e., valid) tables, this means ancestral mutations precede their descendants, so
        older mutations (as defined by the canonical mutation ordering; see
        [Mutation requirements](data-model.html#sec-mutation-requirements)) appear before younger ones.

    metadata[#](#tskit.Site.metadata "Link to this definition")
    :   The [metadata](data-model.html#sec-metadata-definition) for this site, decoded if a schema
        applies.

    *property* alleles[#](#tskit.Site.alleles "Link to this definition")
    :   Return the set of all the alleles defined at this site

        Note

        This deliberately returns an (unordered) *set* of the possible allelic
        states (as defined by the site’s ancestral allele and its associated
        mutations). If you wish to obtain an (ordered) *list* of alleles, for
        example to translate the numeric genotypes at a site into allelic states,
        you should instead use `.alleles` attribute of the [`Variant`](#tskit.Variant "tskit.Variant") class,
        which unlike this attribute includes `None` as a state when there is
        missing data at a site.

#### The [`Mutation`](#tskit.Mutation "tskit.Mutation") class[#](#the-mutation-class "Link to this heading")

*class* tskit.Mutation[[source]](_modules/tskit/trees.html#Mutation)[#](#tskit.Mutation "Link to this definition")
:   A [mutation](data-model.html#sec-mutation-table-definition) in a tree sequence.

    Modifying the attributes in this class will have **no effect** on the
    underlying tree sequence data.

    id[#](#tskit.Mutation.id "Link to this definition")
    :   The integer ID of this mutation. Varies from 0 to
        [`TreeSequence.num_mutations`](#tskit.TreeSequence.num_mutations "tskit.TreeSequence.num_mutations") - 1.

        Modifying the attributes in this class will have **no effect** on the
        underlying tree sequence data.

    site[#](#tskit.Mutation.site "Link to this definition")
    :   The integer ID of the site that this mutation occurs at. To obtain
        further information about a site with a given ID use [`TreeSequence.site()`](#tskit.TreeSequence.site "tskit.TreeSequence.site").

    node[#](#tskit.Mutation.node "Link to this definition")
    :   The integer ID of the first node that inherits this mutation.
        To obtain further information about a node with a given ID, use
        [`TreeSequence.node()`](#tskit.TreeSequence.node "tskit.TreeSequence.node").

    time[#](#tskit.Mutation.time "Link to this definition")
    :   The occurrence time of this mutation.

    derived\_state[#](#tskit.Mutation.derived_state "Link to this definition")
    :   The derived state for this mutation. This is the state
        inherited by nodes in the subtree rooted at this mutation’s node, unless
        another mutation occurs.

    parent[#](#tskit.Mutation.parent "Link to this definition")
    :   The integer ID of this mutation’s parent mutation. When multiple
        mutations occur at a site along a path in the tree, mutations must
        record the mutation that is immediately above them. If the mutation does
        not have a parent, this is equal to the [`NULL`](#tskit.NULL "tskit.NULL") (-1).
        To obtain further information about a mutation with a given ID, use
        [`TreeSequence.mutation()`](#tskit.TreeSequence.mutation "tskit.TreeSequence.mutation").

    metadata[#](#tskit.Mutation.metadata "Link to this definition")
    :   The [metadata](data-model.html#sec-metadata-definition) for this mutation, decoded if a schema
        applies.

    edge[#](#tskit.Mutation.edge "Link to this definition")
    :   The ID of the edge that this mutation is on.

    inherited\_state[#](#tskit.Mutation.inherited_state "Link to this definition")
    :   The inherited state for this mutation. This is the state that existed at the site
        before this mutation occurred. This is either the ancestral state of the site
        (if the mutation has no parent) or the derived state of the mutation’s
        parent mutation (if it has a parent).

#### The [`Variant`](#tskit.Variant "tskit.Variant") class[#](#the-variant-class "Link to this heading")

*class* tskit.Variant[[source]](_modules/tskit/genotypes.html#Variant)[#](#tskit.Variant "Link to this definition")
:   A variant in a tree sequence, describing the observed genetic variation
    among the specified nodes (by default, the sample nodes) for a given site.
    A variant consists of (a) a tuple of **alleles** listing the potential
    allelic states which the requested nodes at this site can possess; (b) an
    array of **genotypes** mapping node IDs to the observed alleles; (c) a
    reference to the [`Site`](#tskit.Site "tskit.Site") at which the Variant has been decoded; and
    (d) an array of **samples** giving the node ID to which each element of the
    genotypes array corresponds.

    After creation a Variant is not yet decoded, and has no genotypes.
    To decode a Variant, call the [`decode()`](#tskit.Variant.decode "tskit.Variant.decode") method. The Variant class will then
    use a Tree, internal to the Variant, to seek to the position of the site and
    decode the genotypes at that site. It is therefore much more efficient to visit
    sites in sequential genomic order, either in a forwards or backwards direction,
    than to do so randomly.

    Each element in the `alleles` tuple is a string, representing an
    observed allelic state that may be seen at this site. The `alleles` tuple,
    which is guaranteed not to contain any duplicates, is generated in one of two
    ways. The first (and default) way is for `tskit` to generate the encoding on
    the fly while generating genotypes. In this case, the first element of this
    tuple is guaranteed to be the same as the site’s `ancestral_state` value.
    Note that allelic values may be listed that are not referred to by any
    samples. For example, if we have a site that is fixed for the derived state
    (i.e., we have a mutation over the tree root), all genotypes will be 1, but
    the alleles list will be equal to `('0', '1')`. Other than the
    ancestral state being the first allele, the alleles are listed in
    no particular order, and the ordering should not be relied upon
    (but see the notes on missing data below).

    The second way is for the user to define the mapping between
    genotype values and allelic state strings using the
    `alleles` parameter to the [`TreeSequence.variants()`](#tskit.TreeSequence.variants "tskit.TreeSequence.variants") method.
    In this case, there is no indication of which allele is the ancestral state,
    as the ordering is determined by the user.

    The `genotypes` represent the observed allelic states for each requested
    node, such that `var.alleles[var.genotypes[j]]` gives the string allele
    for the node at index `j` (i.e., for `variant.samples[j]`). Thus, the
    elements of the genotypes array are
    indexes into the `alleles` list. The genotypes are provided in this
    way via a numpy numeric array to enable efficient calculations. To obtain a
    (less efficient) array of allele strings for each node, you can use e.g.
    `np.asarray(variant.alleles)[variant.genotypes]`.

    When [missing data](data-model.html#sec-data-model-missing-data) is present at a given
    site, the property `has_missing_data` will be True, at least one element
    of the `genotypes` array will be equal to `tskit.MISSING_DATA`, and the
    last element of the `alleles` array will be `None`. Note that in this
    case `variant.num_alleles` will **not** be equal to
    `len(variant.alleles)`. The rationale for adding `None` to the end of
    the `alleles` list is to help code that does not handle missing data
    correctly fail early rather than introducing subtle and hard-to-find bugs.
    As `tskit.MISSING_DATA` is equal to -1, code that decodes genotypes into
    allelic values without taking missing data into account would otherwise
    incorrectly output the last allele in the list.

    Parameters:
    :   - **tree\_sequence** ([*TreeSequence*](#tskit.TreeSequence "tskit.TreeSequence")) – The tree sequence to which this variant
          belongs.
        - **samples** (*array\_like*) – An array of node IDs for which to generate
          genotypes, or `None` for all sample nodes. Non-sample nodes may also
          be provided to generate genotypes for internal nodes. Default: `None`.
        - **isolated\_as\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the genotype value assigned to
          isolated nodes without mutations (samples or non-samples) is
          [`MISSING_DATA`](#tskit.MISSING_DATA "tskit.MISSING_DATA") (-1). If False, such nodes will be
          assigned the allele index for the ancestral state.
          Default: True.
        - **alleles** ([*tuple*](https://docs.python.org/3/library/stdtypes.html#tuple "(in Python v3.14)")) – A tuple of strings defining the encoding of
          alleles as integer genotype values. At least one allele must be provided.
          If duplicate alleles are provided, output genotypes will always be
          encoded as the first occurrence of the allele. If None (the default),
          the alleles are encoded as they are encountered during genotype
          generation.

    *property* site[#](#tskit.Variant.site "Link to this definition")
    :   The Site object for the site at which this variant has been decoded.

    *property* alleles[#](#tskit.Variant.alleles "Link to this definition")
    :   A tuple of the allelic values which nodes can possess at the current
        site. Unless an encoding of alleles is specified when creating this
        variant instance, the first element of this tuple is always the site’s
        ancestral state.

    *property* samples[#](#tskit.Variant.samples "Link to this definition")
    :   A numpy array of the node ids whose genotypes will be returned
        by the [`genotypes()`](#tskit.Variant.genotypes "tskit.Variant.genotypes") method.

    *property* genotypes[#](#tskit.Variant.genotypes "Link to this definition")
    :   An array of indexes into the list `alleles`, giving the
        state of each requested node at the current site.

    *property* isolated\_as\_missing[#](#tskit.Variant.isolated_as_missing "Link to this definition")
    :   True if isolated nodes are decoded to missing data. If False, isolated
        nodes are decoded to the ancestral state.

    *property* has\_missing\_data[#](#tskit.Variant.has_missing_data "Link to this definition")
    :   True if there is missing data for any of the
        requested nodes at the current site.

    *property* num\_missing[#](#tskit.Variant.num_missing "Link to this definition")
    :   The number of requested nodes with missing data at this site.

    *property* num\_alleles[#](#tskit.Variant.num_alleles "Link to this definition")
    :   The number of distinct alleles at this site. Note that this may
        not be the same as the number of distinct values in the genotypes
        array: firstly missing data is not counted as an allele, and secondly,
        the site may contain mutations to alternative allele states (which are
        counted in the number of alleles) without the mutation being inherited
        by any of the requested nodes.

    decode(*site\_id*)[[source]](_modules/tskit/genotypes.html#Variant.decode)[#](#tskit.Variant.decode "Link to this definition")
    :   Decode the variant at the given site, setting the site ID, genotypes and
        alleles to those of the site and samples of this Variant.

        Parameters:
        :   **site\_id** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the site to decode. This must be a valid site ID.

        Return type:
        :   [`None`](https://docs.python.org/3/library/constants.html#None "(in Python v3.14)")

    copy()[[source]](_modules/tskit/genotypes.html#Variant.copy)[#](#tskit.Variant.copy "Link to this definition")
    :   Create a copy of this Variant. Note that calling [`decode()`](#tskit.Variant.decode "tskit.Variant.decode") on the
        copy will fail as it does not take a copy of the internal tree.

        Return type:
        :   [`Variant`](#tskit.Variant "tskit.genotypes.Variant")

        Returns:
        :   The copy of this Variant.

    states(*missing\_data\_string=None*)[[source]](_modules/tskit/genotypes.html#Variant.states)[#](#tskit.Variant.states "Link to this definition")
    :   Returns the allelic states at this site as an array of strings.

        Warning

        Using this method is inefficient compared to working with the
        underlying integer representation of genotypes as returned by
        the [`genotypes`](#tskit.Variant.genotypes "tskit.Variant.genotypes") property.

        Parameters:
        :   **missing\_data\_string** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string that will be used to represent missing
            data. If any normal allele contains this character, an error is raised.
            Default: None, treated as ‘N’.

        Return type:
        :   [`ndarray`](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")

        Returns:
        :   An numpy array of strings of length `num_sites`.

    counts()[[source]](_modules/tskit/genotypes.html#Variant.counts)[#](#tskit.Variant.counts "Link to this definition")
    :   Returns a [`collections.Counter`](https://docs.python.org/3/library/collections.html#collections.Counter "(in Python v3.14)") object providing counts for each
        possible [`allele`](#tskit.Variant.alleles "tskit.Variant.alleles") at this site: i.e. the number of
        samples possessing that allele among the set of samples specified when creating
        this Variant (by default, this is all the sample nodes in the tree sequence).
        Missing data is represented by an allelic state of `None`.

        Return type:
        :   [`Counter`](https://docs.python.org/3/library/typing.html#typing.Counter "(in Python v3.14)")[[`str`](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)") | [`None`](https://docs.python.org/3/library/constants.html#None "(in Python v3.14)")]

        Returns:
        :   A counter of the number of samples associated with each allele.

    frequencies(*remove\_missing=None*)[[source]](_modules/tskit/genotypes.html#Variant.frequencies)[#](#tskit.Variant.frequencies "Link to this definition")
    :   Return a dictionary mapping each possible [`allele`](#tskit.Variant.alleles "tskit.Variant.alleles")
        at this site to the frequency of that allele: i.e. the number of samples
        with that allele divided by the total number of samples, among the set of
        samples specified when creating this Variant (by default, this is all the
        sample nodes in the tree sequence). Note, therefore, that if a restricted set
        of samples was specified on creation, the allele frequencies returned here
        will *not* be the global allele frequencies in the whole tree sequence.

        Parameters:
        :   **remove\_missing** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, only samples with non-missing data will
            be counted in the total number of samples used to calculate the frequency,
            and no information on the frequency of missing data is returned. Otherwise
            (default), samples with missing data are included when calculating
            frequencies.

        Return type:
        :   [`dict`](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")[[`str`](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)"), [`float`](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")]

        Returns:
        :   A dictionary mapping allelic states to the frequency of each allele
            among the samples

#### The [`Migration`](#tskit.Migration "tskit.Migration") class[#](#the-migration-class "Link to this heading")

*class* tskit.Migration[[source]](_modules/tskit/trees.html#Migration)[#](#tskit.Migration "Link to this definition")
:   A [migration](data-model.html#sec-migration-table-definition) in a tree sequence.

    Modifying the attributes in this class will have **no effect** on the
    underlying tree sequence data.

    left[#](#tskit.Migration.left "Link to this definition")
    :   The left end of the genomic interval covered by this
        migration (inclusive).

    right[#](#tskit.Migration.right "Link to this definition")
    :   The right end of the genomic interval covered by this migration
        (exclusive).

    node[#](#tskit.Migration.node "Link to this definition")
    :   The integer ID of the node involved in this migration event.
        To obtain further information about a node with a given ID, use
        [`TreeSequence.node()`](#tskit.TreeSequence.node "tskit.TreeSequence.node").

    source[#](#tskit.Migration.source "Link to this definition")
    :   The source population ID.

    dest[#](#tskit.Migration.dest "Link to this definition")
    :   The destination population ID.

    time[#](#tskit.Migration.time "Link to this definition")
    :   The time at which this migration occurred at.

    metadata[#](#tskit.Migration.metadata "Link to this definition")
    :   The [metadata](data-model.html#sec-metadata-definition) for this migration, decoded if a schema
        applies.

    id[#](#tskit.Migration.id "Link to this definition")
    :   The integer ID of this migration. Varies from 0 to
        [`TreeSequence.num_migrations`](#tskit.TreeSequence.num_migrations "tskit.TreeSequence.num_migrations") - 1.

#### The [`Population`](#tskit.Population "tskit.Population") class[#](#the-population-class "Link to this heading")

*class* tskit.Population[[source]](_modules/tskit/trees.html#Population)[#](#tskit.Population "Link to this definition")
:   A [population](data-model.html#sec-population-table-definition) in a tree sequence.

    Modifying the attributes in this class will have **no effect** on the
    underlying tree sequence data.

    id[#](#tskit.Population.id "Link to this definition")
    :   The integer ID of this population. Varies from 0 to
        [`TreeSequence.num_populations`](#tskit.TreeSequence.num_populations "tskit.TreeSequence.num_populations") - 1.

    metadata[#](#tskit.Population.metadata "Link to this definition")
    :   The [metadata](data-model.html#sec-metadata-definition) for this population, decoded if a
        schema applies.

#### The [`Provenance`](#tskit.Provenance "tskit.Provenance") class[#](#the-provenance-class "Link to this heading")

*class* tskit.Provenance(*id*, *timestamp*, *record*)[[source]](_modules/tskit/trees.html#Provenance)[#](#tskit.Provenance "Link to this definition")
:   A provenance entry in a tree sequence, detailing how this tree
    sequence was generated, or subsequent operations on it (see [Provenance](provenance.html#sec-provenance)).

    timestamp[#](#tskit.Provenance.timestamp "Link to this definition")
    :   The time that this entry was made

    record[#](#tskit.Provenance.record "Link to this definition")
    :   A JSON string giving details of the provenance (see [Example](provenance.html#sec-provenance-example)
        for an example JSON string)

#### The [`Interval`](#tskit.Interval "tskit.Interval") class[#](#the-interval-class "Link to this heading")

*class* tskit.Interval[[source]](_modules/tskit/trees.html#Interval)[#](#tskit.Interval "Link to this definition")
:   A tuple of 2 numbers, `[left, right)`, defining an interval over the genome.

    left[#](#tskit.Interval.left "Link to this definition")
    :   The left hand end of the interval. By convention this value is included
        in the interval

    right[#](#tskit.Interval.right "Link to this definition")
    :   The right hand end of the interval. By convention this value is *not*
        included in the interval, i.e., the interval is half-open.

    *property* span[#](#tskit.Interval.span "Link to this definition")
    :   The span of the genome covered by this interval, simply `right-left`.

    *property* mid[#](#tskit.Interval.mid "Link to this definition")
    :   The middle point of this interval, simply `left+(right-left)/2`.

#### The [`Rank`](#tskit.Rank "tskit.Rank") class[#](#the-rank-class "Link to this heading")

*class* tskit.Rank[[source]](_modules/tskit/combinatorics.html#Rank)[#](#tskit.Rank "Link to this definition")
:   A tuple of 2 numbers, `(shape, label)`, together defining a unique
    topology for a labeled tree. See [Identifying and counting topologies](topological-analysis.html#sec-combinatorics).

    shape[#](#tskit.Rank.shape "Link to this definition")
    :   A non-negative integer representing the (unlabelled) topology of a tree with a
        defined number of tips.

    label[#](#tskit.Rank.label "Link to this definition")
    :   A non-negative integer representing the order of labels for a given tree topology.

### TableCollection and Table classes[#](#tablecollection-and-table-classes "Link to this heading")

#### The [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") class[#](#the-tablecollection-class "Link to this heading")

Also see the [TableCollection API](#sec-tables-api-table-collection) summary.

*class* tskit.TableCollection(*sequence\_length=0*, *\**, *ll\_tables=None*)[[source]](_modules/tskit/tables.html#TableCollection)[#](#tskit.TableCollection "Link to this definition")
:   A collection of mutable tables defining a tree sequence. See the
    [Data model](data-model.html#sec-data-model) section for definition on the various tables
    and how they together define a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence"). Arbitrary
    data can be stored in a TableCollection, but there are certain
    [requirements](data-model.html#sec-valid-tree-sequence-requirements) that must be
    satisfied for these tables to be interpreted as a tree sequence.

    To obtain an immutable [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance corresponding to the
    current state of a `TableCollection`, please use the [`tree_sequence()`](#tskit.TableCollection.tree_sequence "tskit.TableCollection.tree_sequence")
    method.

    *property* individuals[#](#tskit.TableCollection.individuals "Link to this definition")
    :   The [Individual Table](data-model.html#sec-individual-table-definition) in this collection.

    *property* nodes[#](#tskit.TableCollection.nodes "Link to this definition")
    :   The [Node Table](data-model.html#sec-node-table-definition) in this collection.

    *property* edges[#](#tskit.TableCollection.edges "Link to this definition")
    :   The [Edge Table](data-model.html#sec-edge-table-definition) in this collection.

    *property* migrations[#](#tskit.TableCollection.migrations "Link to this definition")
    :   The [Migration Table](data-model.html#sec-migration-table-definition) in this collection

    *property* sites[#](#tskit.TableCollection.sites "Link to this definition")
    :   The [Site Table](data-model.html#sec-site-table-definition) in this collection.

    *property* mutations[#](#tskit.TableCollection.mutations "Link to this definition")
    :   The [Mutation Table](data-model.html#sec-mutation-table-definition) in this collection.

    *property* populations[#](#tskit.TableCollection.populations "Link to this definition")
    :   The [Population Table](data-model.html#sec-population-table-definition) in this collection.

    *property* provenances[#](#tskit.TableCollection.provenances "Link to this definition")
    :   The [Provenance Table](data-model.html#sec-provenance-table-definition) in this collection.

    *property* indexes[#](#tskit.TableCollection.indexes "Link to this definition")
    :   The edge insertion and removal indexes.

    *property* sequence\_length[#](#tskit.TableCollection.sequence_length "Link to this definition")
    :   The sequence length defining the coordinate space.

    *property* file\_uuid[#](#tskit.TableCollection.file_uuid "Link to this definition")
    :   The UUID for the file this TableCollection is derived
        from, or None if not derived from a file.

    *property* time\_units[#](#tskit.TableCollection.time_units "Link to this definition")
    :   The units used for the time dimension of this TableCollection

    has\_reference\_sequence()[[source]](_modules/tskit/tables.html#TableCollection.has_reference_sequence)[#](#tskit.TableCollection.has_reference_sequence "Link to this definition")
    :   Returns True if this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") has an associated
        [reference sequence](data-model.html#sec-data-model-reference-sequence).

    *property* reference\_sequence[#](#tskit.TableCollection.reference_sequence "Link to this definition")
    :   The [`ReferenceSequence`](#tskit.ReferenceSequence "tskit.ReferenceSequence") associated with this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Note

        Note that the behaviour of this attribute differs from
        [`TreeSequence.reference_sequence`](#tskit.TreeSequence.reference_sequence "tskit.TreeSequence.reference_sequence") in that we return a valid
        instance of [`ReferenceSequence`](#tskit.ReferenceSequence "tskit.ReferenceSequence") even when
        [`TableCollection.has_reference_sequence`](#tskit.TableCollection.has_reference_sequence "tskit.TableCollection.has_reference_sequence") is False. This is
        to allow us to update the state of the reference sequence.

    asdict(*force\_offset\_64=False*)[[source]](_modules/tskit/tables.html#TableCollection.asdict)[#](#tskit.TableCollection.asdict "Link to this definition")
    :   Returns the nested dictionary representation of this TableCollection
        used for interchange.

        Note: the semantics of this method changed at tskit 0.1.0. Previously a
        map of table names to the tables themselves was returned.

        Parameters:
        :   **force\_offset\_64** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, all offset columns will have dtype
            np.uint64. If False (the default) the offset array columns will have
            a dtype of either np.uint32 or np.uint64, depending on the size of the
            corresponding data array.

        Returns:
        :   The dictionary representation of this table collection.

        Return type:
        :   [dict](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")

    *property* table\_name\_map[#](#tskit.TableCollection.table_name_map "Link to this definition")
    :   Returns a dictionary mapping table names to the corresponding
        table instances. For example, the returned dictionary will contain the
        key “edges” that maps to an [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") instance.

    *property* nbytes[#](#tskit.TableCollection.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table collection. Note that this may not be equal to
        the actual memory footprint.

    equals(*other*, *\**, *ignore\_metadata=False*, *ignore\_ts\_metadata=False*, *ignore\_provenance=False*, *ignore\_timestamps=False*, *ignore\_tables=False*, *ignore\_reference\_sequence=False*)[[source]](_modules/tskit/tables.html#TableCollection.equals)[#](#tskit.TableCollection.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two table
        collections are considered equal if their

        - `sequence_length` properties are identical;
        - top-level tree sequence metadata and metadata schemas are
          byte-wise identical;
        - constituent tables are byte-wise identical.

        Some of the requirements in this definition can be relaxed using the
        parameters, which can be used to remove certain parts of the data model
        from the comparison.

        Table indexes are not considered in the equality comparison.

        Parameters:
        :   - **other** ([*TableCollection*](#tskit.TableCollection "tskit.TableCollection")) – Another table collection.
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True *all* metadata and metadata schemas
              will be excluded from the comparison. This includes the top-level
              tree sequence and constituent table metadata (default=False).
            - **ignore\_ts\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the top-level tree sequence
              metadata and metadata schemas will be excluded from the comparison.
              If `ignore_metadata` is True, this parameter has no effect.
            - **ignore\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the provenance tables are
              not included in the comparison.
            - **ignore\_timestamps** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the provenance timestamp column
              is ignored in the comparison. If `ignore_provenance` is True, this
              parameter has no effect.
            - **ignore\_tables** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True no tables are included in the
              comparison, thus comparing only the top-level information.
            - **ignore\_reference\_sequence** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the reference sequence
              is not included in the comparison.

        Returns:
        :   True if other is equal to this table collection; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    assert\_equals(*other*, *\**, *ignore\_metadata=False*, *ignore\_ts\_metadata=False*, *ignore\_provenance=False*, *ignore\_timestamps=False*, *ignore\_tables=False*, *ignore\_reference\_sequence=False*)[[source]](_modules/tskit/tables.html#TableCollection.assert_equals)[#](#tskit.TableCollection.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table collection. Note that table indexes are not checked.

        Parameters:
        :   - **other** – Another table collection (TableCollection or
              ImmutableTableCollection).
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True *all* metadata and metadata schemas
              will be excluded from the comparison. This includes the top-level
              tree sequence and constituent table metadata (default=False).
            - **ignore\_ts\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the top-level tree sequence
              metadata and metadata schemas will be excluded from the comparison.
              If `ignore_metadata` is True, this parameter has no effect.
            - **ignore\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the provenance tables are
              not included in the comparison.
            - **ignore\_timestamps** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the provenance timestamp column
              is ignored in the comparison. If `ignore_provenance` is True, this
              parameter has no effect.
            - **ignore\_tables** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True no tables are included in the
              comparison, thus comparing only the top-level information.
            - **ignore\_reference\_sequence** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True the reference sequence
              is not included in the comparison.

    dump(*file\_or\_path*)[[source]](_modules/tskit/tables.html#TableCollection.dump)[#](#tskit.TableCollection.dump "Link to this definition")
    :   Writes the table collection to the specified path or file object.

        Parameters:
        :   **file\_or\_path** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The file object or path to write the TreeSequence to.

    copy()[[source]](_modules/tskit/tables.html#TableCollection.copy)[#](#tskit.TableCollection.copy "Link to this definition")
    :   Returns a deep copy of this TableCollection.

        Returns:
        :   A deep copy of this TableCollection.

        Return type:
        :   [tskit.TableCollection](#tskit.TableCollection "tskit.TableCollection")

    tree\_sequence()[[source]](_modules/tskit/tables.html#TableCollection.tree_sequence)[#](#tskit.TableCollection.tree_sequence "Link to this definition")
    :   Returns a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance from the tables defined in this
        [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"), building the required indexes if they have not yet
        been created by [`build_index()`](#tskit.TableCollection.build_index "tskit.TableCollection.build_index"). If the table collection does not meet
        the [Valid tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements), for example if the tables
        are not correctly sorted or if they cannot be interpreted as a tree sequence,
        an exception is raised. Note that in the former case, the [`sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort")
        method may be used to ensure that sorting requirements are met.

        Returns:
        :   A [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence") instance reflecting the structures
            defined in this set of tables.

        Return type:
        :   [tskit.TreeSequence](#tskit.TreeSequence "tskit.TreeSequence")

    simplify(*samples=None*, *\**, *reduce\_to\_site\_topology=False*, *filter\_populations=None*, *filter\_individuals=None*, *filter\_sites=None*, *filter\_nodes=None*, *update\_sample\_flags=None*, *keep\_unary=False*, *keep\_unary\_in\_individuals=None*, *keep\_input\_roots=False*, *record\_provenance=True*, *filter\_zero\_mutation\_sites=None*)[[source]](_modules/tskit/tables.html#TableCollection.simplify)[#](#tskit.TableCollection.simplify "Link to this definition")
    :   Simplifies the tables in place to retain only the information necessary
        to reconstruct the tree sequence describing the given `samples`.
        If `filter_nodes` is True (the default), this can change the ID of
        the nodes, so that the node `samples[k]` will have ID `k` in the
        result, resulting in a NodeTable where only the first `len(samples)`
        nodes are marked as samples. The mapping from node IDs in the current
        set of tables to their equivalent values in the simplified tables is
        returned as a numpy array. If an array `a` is returned by this
        function and `u` is the ID of a node in the input table, then
        `a[u]` is the ID of this node in the output table. For any node `u`
        that is not mapped into the output tables, this mapping will equal
        `tskit.NULL` (`-1`).

        Tables operated on by this function must: be sorted (see
        [`TableCollection.sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort")), have children be born strictly after their
        parents, and the intervals on which any node is a child must be
        disjoint. Other than this the tables need not satisfy remaining
        requirements to specify a valid tree sequence (but the resulting tables
        will).

        Note

        To invert the returned `node_map`, that is, to obtain a reverse
        mapping from the node ID in the output table to the node ID in
        the input table, you can use:

        ```python
        rev_map = np.zeros_like(node_map, shape=simplified_ts.num_nodes)
        kept = node_map != tskit.NULL
        rev_map[node_map[kept]] = np.arange(len(node_map))[kept]
        ```

        In this case, no elements of the `rev_map` array will be set to
        `tskit.NULL`.

        See also

        This is identical to [`TreeSequence.simplify()`](#tskit.TreeSequence.simplify "tskit.TreeSequence.simplify") but acts *in place* to
        alter the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection"). Please see the
        [`TreeSequence.simplify()`](#tskit.TreeSequence.simplify "tskit.TreeSequence.simplify") method for a description of the remaining
        parameters.

        Parameters:
        :   - **samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – A list of node IDs to retain as samples. They
              need not be nodes marked as samples in the original tree sequence, but
              will constitute the entire set of samples in the returned tree sequence.
              If not specified or None, use all nodes marked with the IS\_SAMPLE flag.
              The list may be provided as a numpy array (or array-like) object
              (dtype=np.int32).
            - **reduce\_to\_site\_topology** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to reduce the topology down
              to the trees that are present at sites. (Default: False).
            - **filter\_populations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any populations that are
              not referenced by nodes after simplification; new population IDs are
              allocated sequentially from zero. If False, the population table will
              not be altered in any way. (Default: None, treated as True)
            - **filter\_individuals** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any individuals that are
              not referenced by nodes after simplification; new individual IDs are
              allocated sequentially from zero. If False, the individual table will
              not be altered in any way. (Default: None, treated as True)
            - **filter\_sites** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any sites that are
              not referenced by mutations after simplification; new site IDs are
              allocated sequentially from zero. If False, the site table will not
              be altered in any way. (Default: None, treated as True)
            - **filter\_nodes** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, remove any nodes that are
              not referenced by edges after simplification. If False, the only
              potential change to the node table may be to change the node flags
              (if `samples` is specified and different from the existing samples).
              (Default: None, treated as True)
            - **update\_sample\_flags** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, update node flags to so that
              nodes in the specified list of samples have the NODE\_IS\_SAMPLE
              flag after simplification, and nodes that are not in this list
              do not. (Default: None, treated as True)
            - **keep\_unary** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, preserve unary nodes (i.e. nodes with
              exactly one child) that exist on the path from samples to root.
              (Default: False)
            - **keep\_unary\_in\_individuals** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, preserve unary nodes
              that exist on the path from samples to root, but only if they are
              associated with an individual in the individuals table. Cannot be
              specified at the same time as `keep_unary`. (Default: `None`,
              equivalent to False)
            - **keep\_input\_roots** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to retain history ancestral to the
              MRCA of the samples. If `False`, no topology older than the MRCAs of the
              samples will be included. If `True` the roots of all trees in the returned
              tree sequence will be the same roots as in the original tree sequence.
              (Default: False)
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, record details of this call to
              simplify in the returned tree sequence’s provenance information
              (Default: True).
            - **filter\_zero\_mutation\_sites** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Deprecated alias for `filter_sites`.

        Returns:
        :   A numpy array mapping node IDs in the input tables to their
            corresponding node IDs in the output tables.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    link\_ancestors(*samples*, *ancestors*)[[source]](_modules/tskit/tables.html#TableCollection.link_ancestors)[#](#tskit.TableCollection.link_ancestors "Link to this definition")
    :   Returns an [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") instance describing a subset of the genealogical
        relationships between the nodes in `samples` and `ancestors`.

        Each row `parent, child, left, right` in the output table indicates that
        `child` has inherited the segment `[left, right)` from `parent` more
        recently than from any other node in these lists.

        In particular, suppose `samples` is a list of nodes such that `time` is 0
        for each node, and `ancestors` is a list of nodes such that `time` is
        greater than 0.0 for each node. Then each row of the output table will show
        an interval `[left, right)` over which a node in `samples` has inherited
        most recently from a node in `ancestors`, or an interval over which one of
        these `ancestors` has inherited most recently from another node in
        `ancestors`.

        The following table shows which `parent->child` pairs will be shown in the
        output of `link_ancestors`.
        A node is a relevant descendant on a given interval if it also appears somewhere
        in the `parent` column of the outputted table.

        |  |  |
        | --- | --- |
        | Type of relationship | Shown in output of `link_ancestors` |
        | `ancestor->sample` | Always |
        | `ancestor1->ancestor2` | Only if `ancestor2` has a relevant descendant |
        | `sample1->sample2` | Always |
        | `sample->ancestor` | Only if `ancestor` has a relevant descendant |

        The difference between `samples` and `ancestors` is that information about
        the ancestors of a node in `ancestors` will only be retained if it also has a
        relevant descendant, while information about the ancestors of a node in
        `samples` will always be retained.
        The node IDs in `parent` and `child` refer to the IDs in the node table
        of the inputted tree sequence.

        The supplied nodes must be non-empty lists of the node IDs in the tree sequence:
        in particular, they do not have to be *samples* of the tree sequence. The lists
        of `samples` and `ancestors` may overlap, although adding a node from
        `samples` to `ancestors` will not change the output. So, setting `samples`
        and `ancestors` to the same list of nodes will find all genealogical
        relationships within this list.

        If none of the nodes in `ancestors` or `samples` are ancestral to `samples`
        anywhere in the tree sequence, an empty table will be returned.

        Parameters:
        :   - **samples** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – A list of node IDs to retain as samples.
            - **ancestors** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – A list of node IDs to use as ancestors.

        Returns:
        :   An [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") instance displaying relationships between
            the samples and ancestors.

    sort(*edge\_start=0*, *\**, *site\_start=0*, *mutation\_start=0*)[[source]](_modules/tskit/tables.html#TableCollection.sort)[#](#tskit.TableCollection.sort "Link to this definition")
    :   Sorts the tables in place. This ensures that all tree sequence ordering
        requirements listed in the
        [Valid tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements) section are met, as long
        as each site has at most one mutation (see below).

        If the `edge_start` parameter is provided, this specifies the index
        in the edge table where sorting should start. Only rows with index
        greater than or equal to `edge_start` are sorted; rows before this index
        are not affected. This parameter is provided to allow for efficient sorting
        when the user knows that the edges up to a given index are already sorted.

        If both `site_start` and `mutation_start` are equal to the number of rows
        in their retrospective tables then neither is sorted. Note that a partial
        non-sorting is not possible, and both or neither must be skipped.

        The node, individual, population and provenance tables are not affected
        by this method.

        Edges are sorted as follows:

        - time of parent, then
        - parent node ID, then
        - child node ID, then
        - left endpoint.

        Note that this sorting order exceeds the
        [edge sorting requirements](data-model.html#sec-edge-requirements) for a valid
        tree sequence. For a valid tree sequence, we require that all edges for a
        given parent ID are adjacent, but we do not require that they be listed in
        sorted order.

        Sites are sorted by position, and sites with the same position retain
        their relative ordering.

        Mutations are sorted by site, then time (if known), then the mutation’s
        node’s time, then number of descendant mutations (ensuring that parent
        mutations occur before children), then node, then original order in the
        tables.

        Migrations are sorted by `time`, `source`, `dest`, `left` and
        `node` values. This defines a total sort order, such that any permutation
        of a valid migration table will be sorted into the same output order.
        Note that this sorting order exceeds the
        [migration sorting requirements](data-model.html#sec-migration-requirements) for a
        valid tree sequence, which only requires that migrations are sorted by
        time value.

        Parameters:
        :   - **edge\_start** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The index in the edge table where sorting starts
              (default=0; must be <= len(edges)).
            - **site\_start** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The index in the site table where sorting starts
              (default=0; must be one of [0, len(sites)]).
            - **mutation\_start** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The index in the mutation table where sorting starts
              (default=0; must be one of [0, len(mutations)]).

    sort\_individuals()[[source]](_modules/tskit/tables.html#TableCollection.sort_individuals)[#](#tskit.TableCollection.sort_individuals "Link to this definition")
    :   Sorts the individual table in place, so that parents come before children,
        and the parent column is remapped as required. Node references to individuals
        are also updated.

    canonicalise(*remove\_unreferenced=None*)[[source]](_modules/tskit/tables.html#TableCollection.canonicalise)[#](#tskit.TableCollection.canonicalise "Link to this definition")
    :   This puts the tables in *canonical* form, imposing a stricter order on the
        tables than [required](data-model.html#sec-valid-tree-sequence-requirements) for
        a valid tree sequence. In particular, the individual
        and population tables are sorted by the first node that refers to each
        (see [`TreeSequence.subset()`](#tskit.TreeSequence.subset "tskit.TreeSequence.subset")). Then, the remaining tables are sorted
        as in [`sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort"), with the modification that mutations are sorted by
        site, then time (if known), then the mutation’s node’s time, then number
        of descendant mutations (ensuring that parent mutations occur before
        children), then node, then original order in the tables. This ensures
        that any two tables with the same information
        and node order should be identical after canonical sorting (note
        that no canonical order exists for the node table).

        By default, the method removes sites, individuals, and populations that
        are not referenced (by mutations and nodes, respectively). If you wish
        to keep these, pass `remove_unreferenced=False`, but note that
        unreferenced individuals and populations are put at the end of the tables
        in their original order.

        See also

        [`sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort") for sorting edges, mutations, and sites, and
        [`subset()`](#tskit.TableCollection.subset "tskit.TableCollection.subset") for reordering nodes, individuals, and populations.

        Parameters:
        :   **remove\_unreferenced** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to remove unreferenced sites,
            individuals, and populations (default=True).

    compute\_mutation\_parents()[[source]](_modules/tskit/tables.html#TableCollection.compute_mutation_parents)[#](#tskit.TableCollection.compute_mutation_parents "Link to this definition")
    :   Modifies the tables in place, computing the `parent` column of the
        mutation table. For this to work, the node and edge tables must be
        valid, and the site and mutation tables must be sorted (see
        [`TableCollection.sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort")). This will produce an error if mutations
        are not sorted (i.e., if a mutation appears before its mutation parent)
        *unless* the two mutations occur on the same branch, and have unknown times
        in which case there is no way to detect the error.

        The `parent` of a given mutation is the ID of the next mutation
        encountered traversing the tree upwards from that mutation, or
        `NULL` if there is no such mutation.

    compute\_mutation\_times()[[source]](_modules/tskit/tables.html#TableCollection.compute_mutation_times)[#](#tskit.TableCollection.compute_mutation_times "Link to this definition")
    :   Modifies the tables in place, computing valid values for the `time` column of
        the mutation table. For this to work, the node and edge tables must be
        valid, and the site and mutation tables must be sorted and indexed(see
        [`TableCollection.sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort") and [`TableCollection.build_index()`](#tskit.TableCollection.build_index "tskit.TableCollection.build_index")).

        For a single mutation on an edge at a site, the `time` assigned to a mutation
        by this method is the mid-point between the times of the nodes above and below
        the mutation. In the case where there is more than one mutation on an edge for
        a site, the times are evenly spread along the edge. For mutations that are
        above a root node, the time of the root node is assigned.

        The mutation table will be sorted if the new times mean that the original order
        is no longer valid.

    deduplicate\_sites()[[source]](_modules/tskit/tables.html#TableCollection.deduplicate_sites)[#](#tskit.TableCollection.deduplicate_sites "Link to this definition")
    :   Modifies the tables in place, removing entries in the site table with
        duplicate `position` (and keeping only the *first* entry for each
        site), and renumbering the `site` column of the mutation table
        appropriately. This requires the site table to be sorted by position.

        Warning

        This method does not sort the tables afterwards, so
        mutations may no longer be sorted by time.

    delete\_sites(*site\_ids*, *record\_provenance=True*)[[source]](_modules/tskit/tables.html#TableCollection.delete_sites)[#](#tskit.TableCollection.delete_sites "Link to this definition")
    :   Remove the specified sites entirely from the sites and mutations tables in this
        collection. This is identical to [`TreeSequence.delete_sites()`](#tskit.TreeSequence.delete_sites "tskit.TreeSequence.delete_sites") but acts
        *in place* to alter the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Parameters:
        :   - **site\_ids** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")*]*) – A list of site IDs specifying the sites to remove.
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation
              to the provenance table in this TableCollection. (Default: `True`).

    delete\_intervals(*intervals*, *simplify=True*, *record\_provenance=True*)[[source]](_modules/tskit/tables.html#TableCollection.delete_intervals)[#](#tskit.TableCollection.delete_intervals "Link to this definition")
    :   Delete all information from this set of tables which lies *within* the
        specified list of genomic intervals. This is identical to
        [`TreeSequence.delete_intervals()`](#tskit.TreeSequence.delete_intervals "tskit.TreeSequence.delete_intervals") but acts *in place* to alter
        the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Parameters:
        :   - **intervals** (*array\_like*) – A list (start, end) pairs describing the
              genomic intervals to delete. Intervals must be non-overlapping and
              in increasing order. The list of intervals must be interpretable as a
              2D numpy array with shape (N, 2), where N is the number of intervals.
            - **simplify** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, run simplify on the tables so that nodes
              no longer used are discarded. (Default: True).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation
              to the provenance table in this TableCollection. (Default: `True`).

    keep\_intervals(*intervals*, *simplify=True*, *record\_provenance=True*)[[source]](_modules/tskit/tables.html#TableCollection.keep_intervals)[#](#tskit.TableCollection.keep_intervals "Link to this definition")
    :   Delete all information from this set of tables which lies *outside* the
        specified list of genomic intervals. This is identical to
        [`TreeSequence.keep_intervals()`](#tskit.TreeSequence.keep_intervals "tskit.TreeSequence.keep_intervals") but acts *in place* to alter
        the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Parameters:
        :   - **intervals** (*array\_like*) – A list (start, end) pairs describing the
              genomic intervals to keep. Intervals must be non-overlapping and
              in increasing order. The list of intervals must be interpretable as a
              2D numpy array with shape (N, 2), where N is the number of intervals.
            - **simplify** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, run simplify on the tables so that nodes
              no longer used are discarded. Must be `False` if input tree sequence
              includes migrations. (Default: True).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation
              to the provenance table in this TableCollection. (Default: `True`).

    ltrim(*record\_provenance=True*)[[source]](_modules/tskit/tables.html#TableCollection.ltrim)[#](#tskit.TableCollection.ltrim "Link to this definition")
    :   Reset the coordinate system used in these tables, changing the left and right
        genomic positions in the edge table such that the leftmost edge now starts at
        position 0. This is identical to [`TreeSequence.ltrim()`](#tskit.TreeSequence.ltrim "tskit.TreeSequence.ltrim") but acts *in place*
        to alter the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Parameters:
        :   **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation
            to the provenance table in this TableCollection. (Default: `True`).

    rtrim(*record\_provenance=True*)[[source]](_modules/tskit/tables.html#TableCollection.rtrim)[#](#tskit.TableCollection.rtrim "Link to this definition")
    :   Reset the `sequence_length` property so that the sequence ends at the end of
        the last edge. This is identical to [`TreeSequence.rtrim()`](#tskit.TreeSequence.rtrim "tskit.TreeSequence.rtrim") but acts
        *in place* to alter the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Parameters:
        :   **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation
            to the provenance table in this TableCollection. (Default: `True`).

    trim(*record\_provenance=True*)[[source]](_modules/tskit/tables.html#TableCollection.trim)[#](#tskit.TableCollection.trim "Link to this definition")
    :   Trim away any empty regions on the right and left of the tree sequence encoded by
        these tables. This is identical to [`TreeSequence.trim()`](#tskit.TreeSequence.trim "tskit.TreeSequence.trim") but acts *in place*
        to alter the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Parameters:
        :   **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, add details of this operation
            to the provenance table in this TableCollection. (Default: `True`).

    shift(*value*, *\**, *sequence\_length=None*, *record\_provenance=True*)[[source]](_modules/tskit/tables.html#TableCollection.shift)[#](#tskit.TableCollection.shift "Link to this definition")
    :   Shift the coordinate system (used by edges, sites, and migrations) of this
        TableCollection by a given value. This is identical to [`TreeSequence.shift()`](#tskit.TreeSequence.shift "tskit.TreeSequence.shift")
        but acts *in place* to alter the data in this [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Note

        No attempt is made to check that the new coordinate system or sequence length
        is valid: if you wish to do this, use {meth}`TreeSequence.shift` instead.

        Parameters:
        :   - **value** – The amount by which to shift the coordinate system.
            - **sequence\_length** – The new sequence length of the tree sequence. If
              `None` (default) add value to the sequence length.

    delete\_older(*time*)[[source]](_modules/tskit/tables.html#TableCollection.delete_older)[#](#tskit.TableCollection.delete_older "Link to this definition")
    :   Deletes edge, mutation and migration information at least as old as
        the specified time.

        See also

        This method is similar to the higher-level
        [`TreeSequence.decapitate()`](#tskit.TreeSequence.decapitate "tskit.TreeSequence.decapitate") method, which also splits
        edges that intersect with the given time.
        [`TreeSequence.decapitate()`](#tskit.TreeSequence.decapitate "tskit.TreeSequence.decapitate")
        is more useful for most purposes, and may be what
        you need instead of this method!

        For the purposes of this method, an edge covers the times from the
        child node up until the *parent* node, so that any any edge with parent
        node time > `time` will be removed.

        Any mutation whose time is >= `time` will be removed. A mutation’s time
        is its associated `time` value, or the time of its node if the
        mutation’s time was marked as unknown ([`UNKNOWN_TIME`](#tskit.UNKNOWN_TIME "tskit.UNKNOWN_TIME")).

        Any migration with time >= `time` will be removed.

        The node table is not affected by this operation.

        Note

        This method does not have any specific sorting requirements
        and will maintain mutation parent mappings.

        Parameters:
        :   **time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The cutoff time.

    clear(*clear\_provenance=False*, *clear\_metadata\_schemas=False*, *clear\_ts\_metadata\_and\_schema=False*)[[source]](_modules/tskit/tables.html#TableCollection.clear)[#](#tskit.TableCollection.clear "Link to this definition")
    :   Remove all rows of the data tables, optionally remove provenance, metadata
        schemas and ts-level metadata.

        Parameters:
        :   - **clear\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, remove all rows of the provenance
              table. (Default: `False`).
            - **clear\_metadata\_schemas** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, clear the table metadata
              schemas. (Default: `False`).
            - **clear\_ts\_metadata\_and\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If `True`, clear the tree-sequence
              level metadata and schema (Default: `False`).

    has\_index()[[source]](_modules/tskit/tables.html#TableCollection.has_index)[#](#tskit.TableCollection.has_index "Link to this definition")
    :   Returns True if this TableCollection is indexed. See [Table indexes](data-model.html#sec-table-indexes)
        for information on indexes.

    build\_index()[[source]](_modules/tskit/tables.html#TableCollection.build_index)[#](#tskit.TableCollection.build_index "Link to this definition")
    :   Builds an index on this TableCollection. Any existing indexes are automatically
        dropped. See [Table indexes](data-model.html#sec-table-indexes) for information on indexes.

    drop\_index()[[source]](_modules/tskit/tables.html#TableCollection.drop_index)[#](#tskit.TableCollection.drop_index "Link to this definition")
    :   Drops any indexes present on this table collection. If the tables are not
        currently indexed this method has no effect. See [Table indexes](data-model.html#sec-table-indexes)
        for information on indexes.

    subset(*nodes*, *record\_provenance=True*, *\**, *reorder\_populations=None*, *remove\_unreferenced=None*)[[source]](_modules/tskit/tables.html#TableCollection.subset)[#](#tskit.TableCollection.subset "Link to this definition")
    :   Modifies the tables in place to contain only the entries referring to
        the provided list of node IDs, with nodes reordered according to the
        order they appear in the list. Other tables are [`sorted`](#tskit.TableCollection.sort "tskit.TableCollection.sort")
        to conform to the [Valid tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements), and
        additionally sorted as described in the documentation for the equivalent
        tree sequence method [`TreeSequence.subset()`](#tskit.TreeSequence.subset "tskit.TreeSequence.subset"): please see this for more
        detail.

        Parameters:
        :   - **nodes** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – The list of nodes for which to retain information. This
              may be a numpy array (or array-like) object (dtype=np.int32).
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to record a provenance entry
              in the provenance table for this operation.
            - **reorder\_populations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to reorder the population table
              (default: True). If False, the population table will not be altered
              in any way.
            - **remove\_unreferenced** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether sites, individuals, and populations
              that are not referred to by any retained entries in the tables should
              be removed (default: True). See the description for details.

    union(*other*, *node\_mapping*, *check\_shared\_equality=True*, *add\_populations=True*, *record\_provenance=True*, *\**, *all\_edges=False*, *all\_mutations=False*)[[source]](_modules/tskit/tables.html#TableCollection.union)[#](#tskit.TableCollection.union "Link to this definition")
    :   Modifies the table collection in place by adding the non-shared
        portions of `other` to itself. To perform the node-wise union,
        the method relies on a `node_mapping` array, that maps nodes in
        `other` to its equivalent node in `self` or `tskit.NULL` if
        the node is exclusive to `other`. See [`TreeSequence.union()`](#tskit.TreeSequence.union "tskit.TreeSequence.union") for a more
        detailed description.

        Parameters:
        :   - **other** ([*TableCollection*](#tskit.TableCollection "tskit.TableCollection")) – Another table collection.
            - **node\_mapping** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – An array of node IDs that relate nodes in
              `other` to nodes in `self`: the k-th element of `node_mapping`
              should be the index of the equivalent node in `self`, or
              `tskit.NULL` if the node is not present in `self` (in which case it
              will be added to self).
            - **check\_shared\_equality** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, the shared portions of the
              table collections will be checked for equality.
            - **add\_populations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, nodes new to `self` will be
              assigned new population IDs.
            - **record\_provenance** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – Whether to record a provenance entry
              in the provenance table for this operation.
            - **all\_edges** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, then all edges in `other` are added
              to `self`.
            - **all\_mutations** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True, then all mutations in `other` are added
              to `self`.

    ibd\_segments(*\**, *within=None*, *between=None*, *max\_time=None*, *min\_span=None*, *store\_pairs=None*, *store\_segments=None*)[[source]](_modules/tskit/tables.html#TableCollection.ibd_segments)[#](#tskit.TableCollection.ibd_segments "Link to this definition")
    :   Equivalent to the [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method; please see its
        documentation for more details, and use this method only if you specifically need
        to work with a [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") object.

        This method has the same data requirements as
        [`TableCollection.simplify()`](#tskit.TableCollection.simplify "tskit.TableCollection.simplify"). In particular, the tables in the collection
        have [required](data-model.html#sec-valid-tree-sequence-requirements) sorting orders.
        To enforce this, you can call [`TableCollection.sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort") before using this
        method. If the edge table contains any edges with identical
        parents and children over adjacent genomic intervals, any IBD intervals
        underneath the edges will also be split across the breakpoint(s). To prevent this
        behaviour in this situation, use [`EdgeTable.squash()`](#tskit.EdgeTable.squash "tskit.EdgeTable.squash") beforehand.

        Parameters:
        :   - **within** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – As for the [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method.
            - **between** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*[*[*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*]*) – As for the [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method.
            - **max\_time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – As for the [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method.
            - **min\_span** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – As for the [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method.
            - **store\_pairs** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – As for the [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method.
            - **store\_segments** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – As for the [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments") method.

        Returns:
        :   An [`IdentitySegments`](#tskit.IdentitySegments "tskit.IdentitySegments") object containing the recorded
            IBD information.

        Return type:
        :   [IdentitySegments](#tskit.IdentitySegments "tskit.IdentitySegments")

    *property* metadata[#](#tskit.TableCollection.metadata "Link to this definition")
    :   The decoded metadata for this object.

    *property* metadata\_bytes[#](#tskit.TableCollection.metadata_bytes "Link to this definition")
    :   The raw bytes of metadata for this TableCollection

    *property* metadata\_schema[#](#tskit.TableCollection.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this object.

#### [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable") classes[#](#individualtable-classes "Link to this heading")

*class* tskit.IndividualTable[[source]](_modules/tskit/tables.html#IndividualTable)[#](#tskit.IndividualTable "Link to this definition")
:   A table defining the individuals in a tree sequence. Note that although
    each Individual has associated nodes, reference to these is not stored in
    the individual table, but rather reference to the individual is stored for
    each node in the [`NodeTable`](#tskit.NodeTable "tskit.NodeTable"). This is similar to the way in which
    the relationship between sites and mutations is modelled.

    Warning

    The numpy arrays returned by table attribute accesses are copies
    of the underlying data. In particular, this means that editing
    individual values in the arrays will not change the table data
    Instead, you should set entire columns or rows at once
    (see [Accessing table data](#sec-tables-api-accessing-table-data)).

    Variables:
    :   - **flags** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of flags values.
        - **location** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The flattened array of floating point location values. See
          [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for more details.
        - **location\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the location column. See
          [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for more details.
        - **parents** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The flattened array of parent individual ids. See
          [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for more details.
        - **parents\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the parents column. See
          [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) for more details.
        - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of binary metadata values. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the metadata column. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_schema** ([*tskit.MetadataSchema*](#tskit.MetadataSchema "tskit.MetadataSchema")) – The metadata schema for this table’s metadata column

    add\_row(*flags=0*, *location=None*, *parents=None*, *metadata=None*)[[source]](_modules/tskit/tables.html#IndividualTable.add_row)[#](#tskit.IndividualTable.add_row "Link to this definition")
    :   Adds a new row to this [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable") and returns the ID of the
        corresponding individual. Metadata, if specified, will be validated and encoded
        according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   - **flags** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The bitwise flags for the new node.
            - **location** (*array-like*) – A list of numeric values or one-dimensional numpy
              array describing the location of this individual. If not specified
              or None, a zero-dimensional location is stored.
            - **parents** (*array-like*) – A list or array of ids of parent individuals. If not
              specified an empty array is stored.
            - **metadata** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – Any object that is valid metadata for the table’s schema.
              Defaults to the default metadata value for the table’s schema. This is
              typically `{}`. For no schema, `None`.

        Returns:
        :   The ID of the newly added individual.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    set\_columns(*flags=None*, *location=None*, *location\_offset=None*, *parents=None*, *parents\_offset=None*, *metadata=None*, *metadata\_offset=None*, *metadata\_schema=None*)[[source]](_modules/tskit/tables.html#IndividualTable.set_columns)[#](#tskit.IndividualTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable") using the
        values in the specified arrays. Overwrites existing data in all the table
        columns.

        The `flags` array is mandatory and defines the number of individuals
        the table will contain.
        The `location` and `location_offset` parameters must be supplied
        together, and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        The `parents` and `parents_offset` parameters must be supplied
        together, and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        The `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **flags** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The bitwise flags for each individual. Required.
            - **location** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The flattened location array. Must be specified along
              with `location_offset`. If not specified or None, an empty location
              value is stored for each individual.
            - **location\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `location` array.
            - **parents** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The flattened parents array. Must be specified along
              with `parents_offset`. If not specified or None, an empty parents array
              is stored for each individual.
            - **parents\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `parents` array.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each individual.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.
            - **metadata\_schema** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The encoded metadata schema. If None (default)
              do not overwrite the exising schema. Note that a schema will need to be
              encoded as a string, e.g. via `repr(new_metadata_schema)`.

    append\_columns(*flags=None*, *location=None*, *location\_offset=None*, *parents=None*, *parents\_offset=None*, *metadata=None*, *metadata\_offset=None*)[[source]](_modules/tskit/tables.html#IndividualTable.append_columns)[#](#tskit.IndividualTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns in this
        [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable"). This allows many new rows to be added at once.

        The `flags` array is mandatory and defines the number of
        extra individuals to add to the table.
        The `parents` and `parents_offset` parameters must be supplied
        together, and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        The `location` and `location_offset` parameters must be supplied
        together, and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        The `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **flags** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The bitwise flags for each individual. Required.
            - **location** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The flattened location array. Must be specified along
              with `location_offset`. If not specified or None, an empty location
              value is stored for each individual.
            - **location\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `location` array.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each individual.
            - **parents** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The flattened parents array. Must be specified along
              with `parents_offset`. If not specified or None, an empty parents array
              is stored for each individual.
            - **parents\_offset** – The offsets into the `parents` array.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.

    packset\_location(*locations*)[[source]](_modules/tskit/tables.html#IndividualTable.packset_location)[#](#tskit.IndividualTable.packset_location "Link to this definition")
    :   Packs the specified list of location values and updates the `location`
        and `location_offset` columns. The length of the locations array
        must be equal to the number of rows in the table.

        Parameters:
        :   **locations** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of locations interpreted as numpy float64
            arrays.

    packset\_parents(*parents*)[[source]](_modules/tskit/tables.html#IndividualTable.packset_parents)[#](#tskit.IndividualTable.packset_parents "Link to this definition")
    :   Packs the specified list of parent values and updates the `parent`
        and `parent_offset` columns. The length of the parents array
        must be equal to the number of rows in the table.

        Parameters:
        :   **parents** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of list of parent ids, interpreted as numpy int32
            arrays.

    keep\_rows(*keep*)[[source]](_modules/tskit/tables.html#IndividualTable.keep_rows)[#](#tskit.IndividualTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        The values in the `parents` column are updated according to this
        map, so that reference integrity within the table is maintained.
        As a consequence of this, the values in the `parents` column
        for kept rows are bounds-checked and an error raised if they
        are not valid. Rows that are deleted are not checked for
        parent ID integrity.

        If an attempt is made to delete rows that are referred to by
        the `parents` column of rows that are retained, an error
        is raised.

        These error conditions are checked before any alterations to
        the table are made.

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    \_\_getitem\_\_(*index*)[#](#tskit.IndividualTable.__getitem__ "Link to this definition")
    :   If passed an integer, return the specified row of this table, decoding metadata
        if it is present. Supports negative indexing, e.g. `table[-5]`.
        If passed a slice, iterable or array return a new table containing the specified
        rows. Similar to numpy fancy indexing, if the array or iterables contains
        booleans then the index acts as a mask, returning those rows for which the mask
        is True. Note that as the result is a new table, the row ids will change as tskit
        row ids are row indexes.

        Parameters:
        :   **index** – the index of a desired row, a slice of the desired rows, an
            iterable or array of the desired row numbers, or a boolean array to use as
            a mask.

    append(*row*)[#](#tskit.IndividualTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.IndividualTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    assert\_equals(*other*, *\**, *ignore\_metadata=False*)[#](#tskit.IndividualTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table of the same type.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

    clear()[#](#tskit.IndividualTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.IndividualTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    drop\_metadata(*\**, *keep\_schema=False*)[#](#tskit.IndividualTable.drop_metadata "Link to this definition")
    :   Drops all metadata in this table. By default, the schema is also cleared,
        except if `keep_schema` is True.

        Parameters:
        :   **keep\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the current schema should be kept intact.

    equals(*other*, *ignore\_metadata=False*)[#](#tskit.IndividualTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two tables
        are considered equal if their columns and metadata schemas are
        byte-for-byte identical.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

        Returns:
        :   True if other is equal to this table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    *property* metadata\_schema[#](#tskit.IndividualTable.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this table.

    metadata\_vector(*key*, *\**, *dtype=None*, *default\_value=<object object>*)[#](#tskit.IndividualTable.metadata_vector "Link to this definition")
    :   Returns a numpy array of metadata values obtained by extracting `key`
        from each metadata entry, and using `default_value` if the key is
        not present. `key` may be a list, in which case nested values are returned.
        For instance, `key = ["a", "x"]` will return an array of
        `row.metadata["a"]["x"]` values, iterated over rows in this table.

        Parameters:
        :   - **key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The name, or a list of names, of metadata entries.
            - **dtype** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The dtype of the result (can usually be omitted).
            - **default\_value** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – The value to be inserted if the metadata key
              is not present. Note that for numeric columns, a default value of None
              will result in a non-numeric array. The default behaviour is to raise
              `KeyError` on missing entries.

    *property* nbytes[#](#tskit.IndividualTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    packset\_metadata(*metadatas*)[#](#tskit.IndividualTable.packset_metadata "Link to this definition")
    :   Packs the specified list of metadata values and updates the `metadata`
        and `metadata_offset` columns. The length of the metadatas array
        must be equal to the number of rows in the table.

        Parameters:
        :   **metadatas** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of metadata bytes values.

    truncate(*num\_rows*)[#](#tskit.IndividualTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#associated-row-class "Link to this heading")

A row returned from an [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Individual`](#tskit.Individual "tskit.Individual") class.

*class* tskit.IndividualTableRow[[source]](_modules/tskit/tables.html#IndividualTableRow)[#](#tskit.IndividualTableRow "Link to this definition")
:   A row in an [`IndividualTable`](#tskit.IndividualTable "tskit.IndividualTable").

    flags[#](#tskit.IndividualTableRow.flags "Link to this definition")
    :   See [`Individual.flags`](#tskit.Individual.flags "tskit.Individual.flags")

    location[#](#tskit.IndividualTableRow.location "Link to this definition")
    :   See [`Individual.location`](#tskit.Individual.location "tskit.Individual.location")

    parents[#](#tskit.IndividualTableRow.parents "Link to this definition")
    :   See [`Individual.parents`](#tskit.Individual.parents "tskit.Individual.parents")

    metadata[#](#tskit.IndividualTableRow.metadata "Link to this definition")
    :   See [`Individual.metadata`](#tskit.Individual.metadata "tskit.Individual.metadata")

    asdict(*\*\*kwargs*)[#](#tskit.IndividualTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.IndividualTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

#### [`NodeTable`](#tskit.NodeTable "tskit.NodeTable") classes[#](#nodetable-classes "Link to this heading")

*class* tskit.NodeTable[[source]](_modules/tskit/tables.html#NodeTable)[#](#tskit.NodeTable "Link to this definition")
:   A table defining the nodes in a tree sequence. See the
    [definitions](data-model.html#sec-node-table-definition) for details on the columns
    in this table and the
    [tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements) section
    for the properties needed for a node table to be a part of a valid tree sequence.

    Warning

    The numpy arrays returned by table attribute accesses are copies
    of the underlying data. In particular, this means that editing
    individual values in the arrays will not change the table data
    Instead, you should set entire columns or rows at once
    (see [Accessing table data](#sec-tables-api-accessing-table-data)).

    Variables:
    :   - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of time values.
        - **flags** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of flags values.
        - **population** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of population IDs.
        - **individual** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of individual IDs that each node belongs to.
        - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of binary metadata values. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the metadata column. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_schema** ([*tskit.MetadataSchema*](#tskit.MetadataSchema "tskit.MetadataSchema")) – The metadata schema for this table’s metadata column

    add\_row(*flags=0*, *time=0*, *population=-1*, *individual=-1*, *metadata=None*)[[source]](_modules/tskit/tables.html#NodeTable.add_row)[#](#tskit.NodeTable.add_row "Link to this definition")
    :   Adds a new row to this [`NodeTable`](#tskit.NodeTable "tskit.NodeTable") and returns the ID of the
        corresponding node. Metadata, if specified, will be validated and encoded
        according to the table’s
        [`metadata_schema`](#tskit.NodeTable.metadata_schema "tskit.NodeTable.metadata_schema").

        Parameters:
        :   - **flags** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The bitwise flags for the new node.
            - **time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The birth time for the new node.
            - **population** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the population in which the new node was born.
              Defaults to [`tskit.NULL`](#tskit.NULL "tskit.NULL").
            - **individual** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the individual in which the new node was born.
              Defaults to [`tskit.NULL`](#tskit.NULL "tskit.NULL").
            - **metadata** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – Any object that is valid metadata for the table’s schema.
              Defaults to the default metadata value for the table’s schema. This is
              typically `{}`. For no schema, `None`.

        Returns:
        :   The ID of the newly added node.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    set\_columns(*flags=None*, *time=None*, *population=None*, *individual=None*, *metadata=None*, *metadata\_offset=None*, *metadata\_schema=None*)[[source]](_modules/tskit/tables.html#NodeTable.set_columns)[#](#tskit.NodeTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`NodeTable`](#tskit.NodeTable "tskit.NodeTable") using the values in
        the specified arrays. Overwrites existing data in all the table columns.

        The `flags`, `time` and `population` arrays must all be of the same length,
        which is equal to the number of nodes the table will contain. The
        `metadata` and `metadata_offset` parameters must be supplied together, and
        meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **flags** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The bitwise flags for each node. Required.
            - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The time values for each node. Required.
            - **population** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The population values for each node. If not specified
              or None, the [`tskit.NULL`](#tskit.NULL "tskit.NULL") value is stored for each node.
            - **individual** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The individual values for each node. If not specified
              or None, the [`tskit.NULL`](#tskit.NULL "tskit.NULL") value is stored for each node.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.
            - **metadata\_schema** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The encoded metadata schema. If None (default)
              do not overwrite the exising schema. Note that a schema will need to be
              encoded as a string, e.g. via `repr(new_metadata_schema)`.

    append\_columns(*flags=None*, *time=None*, *population=None*, *individual=None*, *metadata=None*, *metadata\_offset=None*)[[source]](_modules/tskit/tables.html#NodeTable.append_columns)[#](#tskit.NodeTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns in this
        [`NodeTable`](#tskit.NodeTable "tskit.NodeTable"). This allows many new rows to be added at once.

        The `flags`, `time` and `population` arrays must all be of the same length,
        which is equal to the number of nodes that will be added to the table. The
        `metadata` and `metadata_offset` parameters must be supplied together, and
        meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **flags** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The bitwise flags for each node. Required.
            - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The time values for each node. Required.
            - **population** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The population values for each node. If not specified
              or None, the [`tskit.NULL`](#tskit.NULL "tskit.NULL") value is stored for each node.
            - **individual** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The individual values for each node. If not specified
              or None, the [`tskit.NULL`](#tskit.NULL "tskit.NULL") value is stored for each node.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.

    \_\_getitem\_\_(*index*)[#](#tskit.NodeTable.__getitem__ "Link to this definition")
    :   If passed an integer, return the specified row of this table, decoding metadata
        if it is present. Supports negative indexing, e.g. `table[-5]`.
        If passed a slice, iterable or array return a new table containing the specified
        rows. Similar to numpy fancy indexing, if the array or iterables contains
        booleans then the index acts as a mask, returning those rows for which the mask
        is True. Note that as the result is a new table, the row ids will change as tskit
        row ids are row indexes.

        Parameters:
        :   **index** – the index of a desired row, a slice of the desired rows, an
            iterable or array of the desired row numbers, or a boolean array to use as
            a mask.

    append(*row*)[#](#tskit.NodeTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.NodeTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    assert\_equals(*other*, *\**, *ignore\_metadata=False*)[#](#tskit.NodeTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table of the same type.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

    clear()[#](#tskit.NodeTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.NodeTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    drop\_metadata(*\**, *keep\_schema=False*)[#](#tskit.NodeTable.drop_metadata "Link to this definition")
    :   Drops all metadata in this table. By default, the schema is also cleared,
        except if `keep_schema` is True.

        Parameters:
        :   **keep\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the current schema should be kept intact.

    equals(*other*, *ignore\_metadata=False*)[#](#tskit.NodeTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two tables
        are considered equal if their columns and metadata schemas are
        byte-for-byte identical.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

        Returns:
        :   True if other is equal to this table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    keep\_rows(*keep*)[#](#tskit.NodeTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* metadata\_schema[#](#tskit.NodeTable.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this table.

    metadata\_vector(*key*, *\**, *dtype=None*, *default\_value=<object object>*)[#](#tskit.NodeTable.metadata_vector "Link to this definition")
    :   Returns a numpy array of metadata values obtained by extracting `key`
        from each metadata entry, and using `default_value` if the key is
        not present. `key` may be a list, in which case nested values are returned.
        For instance, `key = ["a", "x"]` will return an array of
        `row.metadata["a"]["x"]` values, iterated over rows in this table.

        Parameters:
        :   - **key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The name, or a list of names, of metadata entries.
            - **dtype** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The dtype of the result (can usually be omitted).
            - **default\_value** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – The value to be inserted if the metadata key
              is not present. Note that for numeric columns, a default value of None
              will result in a non-numeric array. The default behaviour is to raise
              `KeyError` on missing entries.

    *property* nbytes[#](#tskit.NodeTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    packset\_metadata(*metadatas*)[#](#tskit.NodeTable.packset_metadata "Link to this definition")
    :   Packs the specified list of metadata values and updates the `metadata`
        and `metadata_offset` columns. The length of the metadatas array
        must be equal to the number of rows in the table.

        Parameters:
        :   **metadatas** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of metadata bytes values.

    truncate(*num\_rows*)[#](#tskit.NodeTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#id10 "Link to this heading")

A row returned from a [`NodeTable`](#tskit.NodeTable "tskit.NodeTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Node`](#tskit.Node "tskit.Node") class.

*class* tskit.NodeTableRow[[source]](_modules/tskit/tables.html#NodeTableRow)[#](#tskit.NodeTableRow "Link to this definition")
:   A row in a [`NodeTable`](#tskit.NodeTable "tskit.NodeTable").

    flags[#](#tskit.NodeTableRow.flags "Link to this definition")
    :   See [`Node.flags`](#tskit.Node.flags "tskit.Node.flags")

    time[#](#tskit.NodeTableRow.time "Link to this definition")
    :   See [`Node.time`](#tskit.Node.time "tskit.Node.time")

    population[#](#tskit.NodeTableRow.population "Link to this definition")
    :   See [`Node.population`](#tskit.Node.population "tskit.Node.population")

    individual[#](#tskit.NodeTableRow.individual "Link to this definition")
    :   See [`Node.individual`](#tskit.Node.individual "tskit.Node.individual")

    metadata[#](#tskit.NodeTableRow.metadata "Link to this definition")
    :   See [`Node.metadata`](#tskit.Node.metadata "tskit.Node.metadata")

    asdict(*\*\*kwargs*)[#](#tskit.NodeTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.NodeTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

#### [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") classes[#](#edgetable-classes "Link to this heading")

*class* tskit.EdgeTable[[source]](_modules/tskit/tables.html#EdgeTable)[#](#tskit.EdgeTable "Link to this definition")
:   A table defining the edges in a tree sequence. See the
    [definitions](data-model.html#sec-edge-table-definition) for details on the columns
    in this table and the
    [tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements) section
    for the properties needed for an edge table to be a part of a valid tree sequence.

    Warning

    The numpy arrays returned by table attribute accesses are copies
    of the underlying data. In particular, this means that editing
    individual values in the arrays will not change the table data
    Instead, you should set entire columns or rows at once
    (see [Accessing table data](#sec-tables-api-accessing-table-data)).

    Variables:
    :   - **left** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of left coordinates.
        - **right** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of right coordinates.
        - **parent** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of parent node IDs.
        - **child** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of child node IDs.
        - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of binary metadata values. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the metadata column. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_schema** ([*tskit.MetadataSchema*](#tskit.MetadataSchema "tskit.MetadataSchema")) – The metadata schema for this table’s metadata column

    add\_row(*left*, *right*, *parent*, *child*, *metadata=None*)[[source]](_modules/tskit/tables.html#EdgeTable.add_row)[#](#tskit.EdgeTable.add_row "Link to this definition")
    :   Adds a new row to this [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") and returns the ID of the
        corresponding edge. Metadata, if specified, will be validated and encoded
        according to the table’s
        [`metadata_schema`](#tskit.EdgeTable.metadata_schema "tskit.EdgeTable.metadata_schema").

        Parameters:
        :   - **left** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The left coordinate (inclusive).
            - **right** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The right coordinate (exclusive).
            - **parent** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of parent node.
            - **child** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of child node.
            - **metadata** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – Any object that is valid metadata for the table’s schema.
              Defaults to the default metadata value for the table’s schema. This is
              typically `{}`. For no schema, `None`.

        Returns:
        :   The ID of the newly added edge.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    set\_columns(*left=None*, *right=None*, *parent=None*, *child=None*, *metadata=None*, *metadata\_offset=None*, *metadata\_schema=None*)[[source]](_modules/tskit/tables.html#EdgeTable.set_columns)[#](#tskit.EdgeTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") using the values
        in the specified arrays. Overwrites existing data in all the table columns.

        The `left`, `right`, `parent` and `child` parameters are mandatory,
        and must be numpy arrays of the same length (which is equal to the number of
        edges the table will contain).
        The `metadata` and `metadata_offset` parameters must be supplied together,
        and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **left** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The left coordinates (inclusive).
            - **right** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The right coordinates (exclusive).
            - **parent** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The parent node IDs.
            - **child** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The child node IDs.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.
            - **metadata\_schema** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The encoded metadata schema. If None (default)
              do not overwrite the exising schema. Note that a schema will need to be
              encoded as a string, e.g. via `repr(new_metadata_schema)`.

    append\_columns(*left*, *right*, *parent*, *child*, *metadata=None*, *metadata\_offset=None*)[[source]](_modules/tskit/tables.html#EdgeTable.append_columns)[#](#tskit.EdgeTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns of this
        [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable"). This allows many new rows to be added at once.

        The `left`, `right`, `parent` and `child` parameters are mandatory,
        and must be numpy arrays of the same length (which is equal to the number of
        additional edges to add to the table). The `metadata` and
        `metadata_offset` parameters must be supplied together, and
        meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **left** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The left coordinates (inclusive).
            - **right** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The right coordinates (exclusive).
            - **parent** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The parent node IDs.
            - **child** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The child node IDs.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.

    squash()[[source]](_modules/tskit/tables.html#EdgeTable.squash)[#](#tskit.EdgeTable.squash "Link to this definition")
    :   Sorts, then condenses the table into the smallest possible number of rows by
        combining any adjacent edges.
        A pair of edges is said to be adjacent if they have the same parent and child
        nodes, and if the left coordinate of one of the edges is equal to the right
        coordinate of the other edge.
        The `squash` method modifies an [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") in place so that any set of
        adjacent edges is replaced by a single edge.
        The new edge will have the same parent and child node, a left coordinate
        equal to the smallest left coordinate in the set, and a right coordinate
        equal to the largest right coordinate in the set.
        The new edge table will be sorted in the order (P, C, L, R): if the node table
        is ordered by increasing node time, as is common, this order will meet the
        [Edge requirements](data-model.html#sec-edge-requirements) for a valid tree sequence, otherwise you will need
        to call [`sort()`](#tskit.TableCollection.sort "tskit.TableCollection.sort") on the entire [`TableCollection`](#tskit.TableCollection "tskit.TableCollection").

        Note

        Note that this method will fail if any edges have non-empty metadata.

    \_\_getitem\_\_(*index*)[#](#tskit.EdgeTable.__getitem__ "Link to this definition")
    :   If passed an integer, return the specified row of this table, decoding metadata
        if it is present. Supports negative indexing, e.g. `table[-5]`.
        If passed a slice, iterable or array return a new table containing the specified
        rows. Similar to numpy fancy indexing, if the array or iterables contains
        booleans then the index acts as a mask, returning those rows for which the mask
        is True. Note that as the result is a new table, the row ids will change as tskit
        row ids are row indexes.

        Parameters:
        :   **index** – the index of a desired row, a slice of the desired rows, an
            iterable or array of the desired row numbers, or a boolean array to use as
            a mask.

    append(*row*)[#](#tskit.EdgeTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.EdgeTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    assert\_equals(*other*, *\**, *ignore\_metadata=False*)[#](#tskit.EdgeTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table of the same type.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

    clear()[#](#tskit.EdgeTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.EdgeTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    drop\_metadata(*\**, *keep\_schema=False*)[#](#tskit.EdgeTable.drop_metadata "Link to this definition")
    :   Drops all metadata in this table. By default, the schema is also cleared,
        except if `keep_schema` is True.

        Parameters:
        :   **keep\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the current schema should be kept intact.

    equals(*other*, *ignore\_metadata=False*)[#](#tskit.EdgeTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two tables
        are considered equal if their columns and metadata schemas are
        byte-for-byte identical.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

        Returns:
        :   True if other is equal to this table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    keep\_rows(*keep*)[#](#tskit.EdgeTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* metadata\_schema[#](#tskit.EdgeTable.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this table.

    metadata\_vector(*key*, *\**, *dtype=None*, *default\_value=<object object>*)[#](#tskit.EdgeTable.metadata_vector "Link to this definition")
    :   Returns a numpy array of metadata values obtained by extracting `key`
        from each metadata entry, and using `default_value` if the key is
        not present. `key` may be a list, in which case nested values are returned.
        For instance, `key = ["a", "x"]` will return an array of
        `row.metadata["a"]["x"]` values, iterated over rows in this table.

        Parameters:
        :   - **key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The name, or a list of names, of metadata entries.
            - **dtype** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The dtype of the result (can usually be omitted).
            - **default\_value** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – The value to be inserted if the metadata key
              is not present. Note that for numeric columns, a default value of None
              will result in a non-numeric array. The default behaviour is to raise
              `KeyError` on missing entries.

    *property* nbytes[#](#tskit.EdgeTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    packset\_metadata(*metadatas*)[#](#tskit.EdgeTable.packset_metadata "Link to this definition")
    :   Packs the specified list of metadata values and updates the `metadata`
        and `metadata_offset` columns. The length of the metadatas array
        must be equal to the number of rows in the table.

        Parameters:
        :   **metadatas** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of metadata bytes values.

    truncate(*num\_rows*)[#](#tskit.EdgeTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#id11 "Link to this heading")

A row returned from an [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Edge`](#tskit.Edge "tskit.Edge") class.

*class* tskit.EdgeTableRow[[source]](_modules/tskit/tables.html#EdgeTableRow)[#](#tskit.EdgeTableRow "Link to this definition")
:   A row in an [`EdgeTable`](#tskit.EdgeTable "tskit.EdgeTable").

    left[#](#tskit.EdgeTableRow.left "Link to this definition")
    :   See [`Edge.left`](#tskit.Edge.left "tskit.Edge.left")

    right[#](#tskit.EdgeTableRow.right "Link to this definition")
    :   See [`Edge.right`](#tskit.Edge.right "tskit.Edge.right")

    parent[#](#tskit.EdgeTableRow.parent "Link to this definition")
    :   See [`Edge.parent`](#tskit.Edge.parent "tskit.Edge.parent")

    child[#](#tskit.EdgeTableRow.child "Link to this definition")
    :   See [`Edge.child`](#tskit.Edge.child "tskit.Edge.child")

    metadata[#](#tskit.EdgeTableRow.metadata "Link to this definition")
    :   See [`Edge.metadata`](#tskit.Edge.metadata "tskit.Edge.metadata")

    asdict(*\*\*kwargs*)[#](#tskit.EdgeTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.EdgeTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

#### [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable") classes[#](#migrationtable-classes "Link to this heading")

*class* tskit.MigrationTable[[source]](_modules/tskit/tables.html#MigrationTable)[#](#tskit.MigrationTable "Link to this definition")
:   A table defining the migrations in a tree sequence. See the
    [definitions](data-model.html#sec-migration-table-definition) for details on the columns
    in this table and the
    [tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements) section
    for the properties needed for a migration table to be a part of a valid tree
    sequence.

    Warning

    The numpy arrays returned by table attribute accesses are copies
    of the underlying data. In particular, this means that editing
    individual values in the arrays will not change the table data
    Instead, you should set entire columns or rows at once
    (see [Accessing table data](#sec-tables-api-accessing-table-data)).

    Variables:
    :   - **left** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of left coordinates.
        - **right** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of right coordinates.
        - **node** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of node IDs.
        - **source** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of source population IDs.
        - **dest** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of destination population IDs.
        - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of time values.
        - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of binary metadata values. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the metadata column. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_schema** ([*tskit.MetadataSchema*](#tskit.MetadataSchema "tskit.MetadataSchema")) – The metadata schema for this table’s metadata column

    add\_row(*left*, *right*, *node*, *source*, *dest*, *time*, *metadata=None*)[[source]](_modules/tskit/tables.html#MigrationTable.add_row)[#](#tskit.MigrationTable.add_row "Link to this definition")
    :   Adds a new row to this [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable") and returns the ID of the
        corresponding migration. Metadata, if specified, will be validated and encoded
        according to the table’s
        [`metadata_schema`](#tskit.MigrationTable.metadata_schema "tskit.MigrationTable.metadata_schema").

        Parameters:
        :   - **left** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The left coordinate (inclusive).
            - **right** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The right coordinate (exclusive).
            - **node** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The node ID.
            - **source** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the source population.
            - **dest** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the destination population.
            - **time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The time of the migration event.
            - **metadata** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – Any object that is valid metadata for the table’s schema.
              Defaults to the default metadata value for the table’s schema. This is
              typically `{}`. For no schema, `None`.

        Returns:
        :   The ID of the newly added migration.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    set\_columns(*left=None*, *right=None*, *node=None*, *source=None*, *dest=None*, *time=None*, *metadata=None*, *metadata\_offset=None*, *metadata\_schema=None*)[[source]](_modules/tskit/tables.html#MigrationTable.set_columns)[#](#tskit.MigrationTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable") using the values
        in the specified arrays. Overwrites existing data in all the table columns.

        All parameters except `metadata` and `metadata_offset` and are mandatory,
        and must be numpy arrays of the same length (which is equal to the number of
        migrations the table will contain).
        The `metadata` and `metadata_offset` parameters must be supplied together,
        and meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **left** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The left coordinates (inclusive).
            - **right** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The right coordinates (exclusive).
            - **node** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The node IDs.
            - **source** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The source population IDs.
            - **dest** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The destination population IDs.
            - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int64*) – The time of each migration.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each migration.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.
            - **metadata\_schema** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The encoded metadata schema. If None (default)
              do not overwrite the exising schema. Note that a schema will need to be
              encoded as a string, e.g. via `repr(new_metadata_schema)`.

    append\_columns(*left*, *right*, *node*, *source*, *dest*, *time*, *metadata=None*, *metadata\_offset=None*)[[source]](_modules/tskit/tables.html#MigrationTable.append_columns)[#](#tskit.MigrationTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns of this
        [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable"). This allows many new rows to be added at once.

        All parameters except `metadata` and `metadata_offset` and are mandatory,
        and must be numpy arrays of the same length (which is equal to the number of
        additional migrations to add to the table). The `metadata` and
        `metadata_offset` parameters must be supplied together, and
        meet the requirements for [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns).
        See [Binary columns](#sec-tables-api-binary-columns) for more information and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **left** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The left coordinates (inclusive).
            - **right** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The right coordinates (exclusive).
            - **node** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The node IDs.
            - **source** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The source population IDs.
            - **dest** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The destination population IDs.
            - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int64*) – The time of each migration.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each migration.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.

    \_\_getitem\_\_(*index*)[#](#tskit.MigrationTable.__getitem__ "Link to this definition")
    :   If passed an integer, return the specified row of this table, decoding metadata
        if it is present. Supports negative indexing, e.g. `table[-5]`.
        If passed a slice, iterable or array return a new table containing the specified
        rows. Similar to numpy fancy indexing, if the array or iterables contains
        booleans then the index acts as a mask, returning those rows for which the mask
        is True. Note that as the result is a new table, the row ids will change as tskit
        row ids are row indexes.

        Parameters:
        :   **index** – the index of a desired row, a slice of the desired rows, an
            iterable or array of the desired row numbers, or a boolean array to use as
            a mask.

    append(*row*)[#](#tskit.MigrationTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.MigrationTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    assert\_equals(*other*, *\**, *ignore\_metadata=False*)[#](#tskit.MigrationTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table of the same type.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

    clear()[#](#tskit.MigrationTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.MigrationTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    drop\_metadata(*\**, *keep\_schema=False*)[#](#tskit.MigrationTable.drop_metadata "Link to this definition")
    :   Drops all metadata in this table. By default, the schema is also cleared,
        except if `keep_schema` is True.

        Parameters:
        :   **keep\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the current schema should be kept intact.

    equals(*other*, *ignore\_metadata=False*)[#](#tskit.MigrationTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two tables
        are considered equal if their columns and metadata schemas are
        byte-for-byte identical.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

        Returns:
        :   True if other is equal to this table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    keep\_rows(*keep*)[#](#tskit.MigrationTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* metadata\_schema[#](#tskit.MigrationTable.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this table.

    metadata\_vector(*key*, *\**, *dtype=None*, *default\_value=<object object>*)[#](#tskit.MigrationTable.metadata_vector "Link to this definition")
    :   Returns a numpy array of metadata values obtained by extracting `key`
        from each metadata entry, and using `default_value` if the key is
        not present. `key` may be a list, in which case nested values are returned.
        For instance, `key = ["a", "x"]` will return an array of
        `row.metadata["a"]["x"]` values, iterated over rows in this table.

        Parameters:
        :   - **key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The name, or a list of names, of metadata entries.
            - **dtype** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The dtype of the result (can usually be omitted).
            - **default\_value** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – The value to be inserted if the metadata key
              is not present. Note that for numeric columns, a default value of None
              will result in a non-numeric array. The default behaviour is to raise
              `KeyError` on missing entries.

    *property* nbytes[#](#tskit.MigrationTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    packset\_metadata(*metadatas*)[#](#tskit.MigrationTable.packset_metadata "Link to this definition")
    :   Packs the specified list of metadata values and updates the `metadata`
        and `metadata_offset` columns. The length of the metadatas array
        must be equal to the number of rows in the table.

        Parameters:
        :   **metadatas** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of metadata bytes values.

    truncate(*num\_rows*)[#](#tskit.MigrationTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#id12 "Link to this heading")

A row returned from a [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Migration`](#tskit.Migration "tskit.Migration") class.

*class* tskit.MigrationTableRow[[source]](_modules/tskit/tables.html#MigrationTableRow)[#](#tskit.MigrationTableRow "Link to this definition")
:   A row in a [`MigrationTable`](#tskit.MigrationTable "tskit.MigrationTable").

    left[#](#tskit.MigrationTableRow.left "Link to this definition")
    :   See [`Migration.left`](#tskit.Migration.left "tskit.Migration.left")

    right[#](#tskit.MigrationTableRow.right "Link to this definition")
    :   See [`Migration.right`](#tskit.Migration.right "tskit.Migration.right")

    node[#](#tskit.MigrationTableRow.node "Link to this definition")
    :   See [`Migration.node`](#tskit.Migration.node "tskit.Migration.node")

    source[#](#tskit.MigrationTableRow.source "Link to this definition")
    :   See [`Migration.source`](#tskit.Migration.source "tskit.Migration.source")

    dest[#](#tskit.MigrationTableRow.dest "Link to this definition")
    :   See [`Migration.dest`](#tskit.Migration.dest "tskit.Migration.dest")

    time[#](#tskit.MigrationTableRow.time "Link to this definition")
    :   See [`Migration.time`](#tskit.Migration.time "tskit.Migration.time")

    metadata[#](#tskit.MigrationTableRow.metadata "Link to this definition")
    :   See [`Migration.metadata`](#tskit.Migration.metadata "tskit.Migration.metadata")

    asdict(*\*\*kwargs*)[#](#tskit.MigrationTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.MigrationTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

#### [`SiteTable`](#tskit.SiteTable "tskit.SiteTable") classes[#](#sitetable-classes "Link to this heading")

*class* tskit.SiteTable[[source]](_modules/tskit/tables.html#SiteTable)[#](#tskit.SiteTable "Link to this definition")
:   A table defining the sites in a tree sequence. See the
    [definitions](data-model.html#sec-site-table-definition) for details on the columns
    in this table and the
    [tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements) section
    for the properties needed for a site table to be a part of a valid tree
    sequence.

    Warning

    The numpy arrays returned by table attribute accesses are copies
    of the underlying data. In particular, this means that editing
    individual values in the arrays will not change the table data
    Instead, you should set entire columns or rows at once
    (see [Accessing table data](#sec-tables-api-accessing-table-data)).

    Variables:
    :   - **position** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of site position coordinates.
        - **ancestral\_state** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of ancestral state strings.
          See [Text columns](#sec-tables-api-text-columns) for more details.
        - **ancestral\_state\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The offsets of rows in the ancestral\_state
          array. See [Text columns](#sec-tables-api-text-columns) for more details.
        - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of binary metadata values. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the metadata column. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_schema** ([*tskit.MetadataSchema*](#tskit.MetadataSchema "tskit.MetadataSchema")) – The metadata schema for this table’s metadata column

    add\_row(*position*, *ancestral\_state*, *metadata=None*)[[source]](_modules/tskit/tables.html#SiteTable.add_row)[#](#tskit.SiteTable.add_row "Link to this definition")
    :   Adds a new row to this [`SiteTable`](#tskit.SiteTable "tskit.SiteTable") and returns the ID of the
        corresponding site. Metadata, if specified, will be validated and encoded
        according to the table’s
        [`metadata_schema`](#tskit.SiteTable.metadata_schema "tskit.SiteTable.metadata_schema").

        Parameters:
        :   - **position** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The position of this site in genome coordinates.
            - **ancestral\_state** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The state of this site at the root of the tree.
            - **metadata** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – Any object that is valid metadata for the table’s schema.
              Defaults to the default metadata value for the table’s schema. This is
              typically `{}`. For no schema, `None`.

        Returns:
        :   The ID of the newly added site.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    set\_columns(*position=None*, *ancestral\_state=None*, *ancestral\_state\_offset=None*, *metadata=None*, *metadata\_offset=None*, *metadata\_schema=None*)[[source]](_modules/tskit/tables.html#SiteTable.set_columns)[#](#tskit.SiteTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`SiteTable`](#tskit.SiteTable "tskit.SiteTable") using the values
        in the specified arrays. Overwrites existing data in all the table columns.

        The `position`, `ancestral_state` and `ancestral_state_offset`
        parameters are mandatory, and must be 1D numpy arrays. The length
        of the `position` array determines the number of rows in table.
        The `ancestral_state` and `ancestral_state_offset` parameters must
        be supplied together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Text columns](#sec-tables-api-text-columns) for more information). The
        `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information) and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **position** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The position of each site in genome coordinates.
            - **ancestral\_state** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened ancestral\_state array. Required.
            - **ancestral\_state\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `ancestral_state` array.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.
            - **metadata\_schema** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The encoded metadata schema. If None (default)
              do not overwrite the exising schema. Note that a schema will need to be
              encoded as a string, e.g. via `repr(new_metadata_schema)`.

    append\_columns(*position*, *ancestral\_state*, *ancestral\_state\_offset*, *metadata=None*, *metadata\_offset=None*)[[source]](_modules/tskit/tables.html#SiteTable.append_columns)[#](#tskit.SiteTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns of this
        [`SiteTable`](#tskit.SiteTable "tskit.SiteTable"). This allows many new rows to be added at once.

        The `position`, `ancestral_state` and `ancestral_state_offset`
        parameters are mandatory, and must be 1D numpy arrays. The length
        of the `position` array determines the number of additional rows
        to add the table.
        The `ancestral_state` and `ancestral_state_offset` parameters must
        be supplied together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Text columns](#sec-tables-api-text-columns) for more information). The
        `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information) and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **position** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The position of each site in genome coordinates.
            - **ancestral\_state** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened ancestral\_state array. Required.
            - **ancestral\_state\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `ancestral_state` array.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.

    packset\_ancestral\_state(*ancestral\_states*)[[source]](_modules/tskit/tables.html#SiteTable.packset_ancestral_state)[#](#tskit.SiteTable.packset_ancestral_state "Link to this definition")
    :   Packs the specified list of ancestral\_state values and updates the
        `ancestral_state` and `ancestral_state_offset` columns. The length
        of the ancestral\_states array must be equal to the number of rows in
        the table.

        Parameters:
        :   **ancestral\_states** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*(*[*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – A list of string ancestral state values.

    \_\_getitem\_\_(*index*)[#](#tskit.SiteTable.__getitem__ "Link to this definition")
    :   If passed an integer, return the specified row of this table, decoding metadata
        if it is present. Supports negative indexing, e.g. `table[-5]`.
        If passed a slice, iterable or array return a new table containing the specified
        rows. Similar to numpy fancy indexing, if the array or iterables contains
        booleans then the index acts as a mask, returning those rows for which the mask
        is True. Note that as the result is a new table, the row ids will change as tskit
        row ids are row indexes.

        Parameters:
        :   **index** – the index of a desired row, a slice of the desired rows, an
            iterable or array of the desired row numbers, or a boolean array to use as
            a mask.

    append(*row*)[#](#tskit.SiteTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.SiteTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    assert\_equals(*other*, *\**, *ignore\_metadata=False*)[#](#tskit.SiteTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table of the same type.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

    clear()[#](#tskit.SiteTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.SiteTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    drop\_metadata(*\**, *keep\_schema=False*)[#](#tskit.SiteTable.drop_metadata "Link to this definition")
    :   Drops all metadata in this table. By default, the schema is also cleared,
        except if `keep_schema` is True.

        Parameters:
        :   **keep\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the current schema should be kept intact.

    equals(*other*, *ignore\_metadata=False*)[#](#tskit.SiteTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two tables
        are considered equal if their columns and metadata schemas are
        byte-for-byte identical.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

        Returns:
        :   True if other is equal to this table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    keep\_rows(*keep*)[#](#tskit.SiteTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* metadata\_schema[#](#tskit.SiteTable.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this table.

    metadata\_vector(*key*, *\**, *dtype=None*, *default\_value=<object object>*)[#](#tskit.SiteTable.metadata_vector "Link to this definition")
    :   Returns a numpy array of metadata values obtained by extracting `key`
        from each metadata entry, and using `default_value` if the key is
        not present. `key` may be a list, in which case nested values are returned.
        For instance, `key = ["a", "x"]` will return an array of
        `row.metadata["a"]["x"]` values, iterated over rows in this table.

        Parameters:
        :   - **key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The name, or a list of names, of metadata entries.
            - **dtype** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The dtype of the result (can usually be omitted).
            - **default\_value** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – The value to be inserted if the metadata key
              is not present. Note that for numeric columns, a default value of None
              will result in a non-numeric array. The default behaviour is to raise
              `KeyError` on missing entries.

    *property* nbytes[#](#tskit.SiteTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    packset\_metadata(*metadatas*)[#](#tskit.SiteTable.packset_metadata "Link to this definition")
    :   Packs the specified list of metadata values and updates the `metadata`
        and `metadata_offset` columns. The length of the metadatas array
        must be equal to the number of rows in the table.

        Parameters:
        :   **metadatas** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of metadata bytes values.

    truncate(*num\_rows*)[#](#tskit.SiteTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#id13 "Link to this heading")

A row returned from a [`SiteTable`](#tskit.SiteTable "tskit.SiteTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Site`](#tskit.Site "tskit.Site") class.

*class* tskit.SiteTableRow[[source]](_modules/tskit/tables.html#SiteTableRow)[#](#tskit.SiteTableRow "Link to this definition")
:   A row in a [`SiteTable`](#tskit.SiteTable "tskit.SiteTable").

    position[#](#tskit.SiteTableRow.position "Link to this definition")
    :   See [`Site.position`](#tskit.Site.position "tskit.Site.position")

    ancestral\_state[#](#tskit.SiteTableRow.ancestral_state "Link to this definition")
    :   See [`Site.ancestral_state`](#tskit.Site.ancestral_state "tskit.Site.ancestral_state")

    metadata[#](#tskit.SiteTableRow.metadata "Link to this definition")
    :   See [`Site.metadata`](#tskit.Site.metadata "tskit.Site.metadata")

    asdict(*\*\*kwargs*)[#](#tskit.SiteTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.SiteTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

#### [`MutationTable`](#tskit.MutationTable "tskit.MutationTable") classes[#](#mutationtable-classes "Link to this heading")

*class* tskit.MutationTable[[source]](_modules/tskit/tables.html#MutationTable)[#](#tskit.MutationTable "Link to this definition")
:   A table defining the mutations in a tree sequence. See the
    [definitions](data-model.html#sec-mutation-table-definition) for details on the columns
    in this table and the
    [tree sequence requirements](data-model.html#sec-valid-tree-sequence-requirements) section
    for the properties needed for a mutation table to be a part of a valid tree
    sequence.

    Warning

    The numpy arrays returned by table attribute accesses are copies
    of the underlying data. In particular, this means that editing
    individual values in the arrays will not change the table data
    Instead, you should set entire columns or rows at once
    (see [Accessing table data](#sec-tables-api-accessing-table-data)).

    Variables:
    :   - **site** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of site IDs.
        - **node** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of node IDs.
        - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The array of time values.
        - **derived\_state** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of derived state strings.
          See [Text columns](#sec-tables-api-text-columns) for more details.
        - **derived\_state\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The offsets of rows in the derived\_state
          array. See [Text columns](#sec-tables-api-text-columns) for more details.
        - **parent** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The array of parent mutation IDs.
        - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of binary metadata values. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the metadata column. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_schema** ([*tskit.MetadataSchema*](#tskit.MetadataSchema "tskit.MetadataSchema")) – The metadata schema for this table’s metadata column

    add\_row(*site*, *node*, *derived\_state*, *parent=-1*, *metadata=None*, *time=None*)[[source]](_modules/tskit/tables.html#MutationTable.add_row)[#](#tskit.MutationTable.add_row "Link to this definition")
    :   Adds a new row to this [`MutationTable`](#tskit.MutationTable "tskit.MutationTable") and returns the ID of the
        corresponding mutation. Metadata, if specified, will be validated and encoded
        according to the table’s
        [`metadata_schema`](#tskit.MutationTable.metadata_schema "tskit.MutationTable.metadata_schema").

        Parameters:
        :   - **site** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the site that this mutation occurs at.
            - **node** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the first node inheriting this mutation.
            - **derived\_state** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The state of the site at this mutation’s node.
            - **parent** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The ID of the parent mutation. If not specified,
              defaults to [`NULL`](#tskit.NULL "tskit.NULL").
            - **metadata** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – Any object that is valid metadata for the table’s schema.
              Defaults to the default metadata value for the table’s schema. This is
              typically `{}`. For no schema, `None`.
            - **time** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The occurrence time for the new mutation. If not specified,
              defaults to `UNKNOWN_TIME`, indicating the time is unknown.

        Returns:
        :   The ID of the newly added mutation.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    set\_columns(*site=None*, *node=None*, *time=None*, *derived\_state=None*, *derived\_state\_offset=None*, *parent=None*, *metadata=None*, *metadata\_offset=None*, *metadata\_schema=None*)[[source]](_modules/tskit/tables.html#MutationTable.set_columns)[#](#tskit.MutationTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`MutationTable`](#tskit.MutationTable "tskit.MutationTable") using the values
        in the specified arrays. Overwrites existing data in all the the table columns.

        The `site`, `node`, `derived_state` and `derived_state_offset`
        parameters are mandatory, and must be 1D numpy arrays. The
        `site` and `node` (also `parent` and `time`, if supplied) arrays
        must be of equal length, and determine the number of rows in the table.
        The `derived_state` and `derived_state_offset` parameters must
        be supplied together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Text columns](#sec-tables-api-text-columns) for more information). The
        `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information) and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **site** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The ID of the site each mutation occurs at.
            - **node** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The ID of the node each mutation is associated with.
            - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The time values for each mutation.
            - **derived\_state** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened derived\_state array. Required.
            - **derived\_state\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `derived_state` array.
            - **parent** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The ID of the parent mutation for each mutation.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.
            - **metadata\_schema** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The encoded metadata schema. If None (default)
              do not overwrite the exising schema. Note that a schema will need to be
              encoded as a string, e.g. via `repr(new_metadata_schema)`.

    append\_columns(*site*, *node*, *derived\_state*, *derived\_state\_offset*, *parent=None*, *time=None*, *metadata=None*, *metadata\_offset=None*)[[source]](_modules/tskit/tables.html#MutationTable.append_columns)[#](#tskit.MutationTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns of this
        [`MutationTable`](#tskit.MutationTable "tskit.MutationTable"). This allows many new rows to be added at once.

        The `site`, `node`, `derived_state` and `derived_state_offset`
        parameters are mandatory, and must be 1D numpy arrays. The
        `site` and `node` (also `time` and `parent`, if supplied) arrays
        must be of equal length, and determine the number of additional
        rows to add to the table.
        The `derived_state` and `derived_state_offset` parameters must
        be supplied together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Text columns](#sec-tables-api-text-columns) for more information). The
        `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information) and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **site** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The ID of the site each mutation occurs at.
            - **node** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The ID of the node each mutation is associated with.
            - **time** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.float64*) – The time values for each mutation.
            - **derived\_state** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened derived\_state array. Required.
            - **derived\_state\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `derived_state` array.
            - **parent** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int32*) – The ID of the parent mutation for each mutation.
            - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.

    packset\_derived\_state(*derived\_states*)[[source]](_modules/tskit/tables.html#MutationTable.packset_derived_state)[#](#tskit.MutationTable.packset_derived_state "Link to this definition")
    :   Packs the specified list of derived\_state values and updates the
        `derived_state` and `derived_state_offset` columns. The length
        of the derived\_states array must be equal to the number of rows in
        the table.

        Parameters:
        :   **derived\_states** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*(*[*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – A list of string derived state values.

    keep\_rows(*keep*)[[source]](_modules/tskit/tables.html#MutationTable.keep_rows)[#](#tskit.MutationTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        The values in the `parent` column are updated according to this
        map, so that reference integrity within the table is maintained.
        As a consequence of this, the values in the `parent` column
        for kept rows are bounds-checked and an error raised if they
        are not valid. Rows that are deleted are not checked for
        parent ID integrity.

        If an attempt is made to delete rows that are referred to by
        the `parent` column of rows that are retained, an error
        is raised.

        These error conditions are checked before any alterations to
        the table are made.

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    \_\_getitem\_\_(*index*)[#](#tskit.MutationTable.__getitem__ "Link to this definition")
    :   If passed an integer, return the specified row of this table, decoding metadata
        if it is present. Supports negative indexing, e.g. `table[-5]`.
        If passed a slice, iterable or array return a new table containing the specified
        rows. Similar to numpy fancy indexing, if the array or iterables contains
        booleans then the index acts as a mask, returning those rows for which the mask
        is True. Note that as the result is a new table, the row ids will change as tskit
        row ids are row indexes.

        Parameters:
        :   **index** – the index of a desired row, a slice of the desired rows, an
            iterable or array of the desired row numbers, or a boolean array to use as
            a mask.

    append(*row*)[#](#tskit.MutationTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.MutationTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    assert\_equals(*other*, *\**, *ignore\_metadata=False*)[#](#tskit.MutationTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table of the same type.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

    clear()[#](#tskit.MutationTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.MutationTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    drop\_metadata(*\**, *keep\_schema=False*)[#](#tskit.MutationTable.drop_metadata "Link to this definition")
    :   Drops all metadata in this table. By default, the schema is also cleared,
        except if `keep_schema` is True.

        Parameters:
        :   **keep\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the current schema should be kept intact.

    equals(*other*, *ignore\_metadata=False*)[#](#tskit.MutationTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two tables
        are considered equal if their columns and metadata schemas are
        byte-for-byte identical.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

        Returns:
        :   True if other is equal to this table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    *property* metadata\_schema[#](#tskit.MutationTable.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this table.

    metadata\_vector(*key*, *\**, *dtype=None*, *default\_value=<object object>*)[#](#tskit.MutationTable.metadata_vector "Link to this definition")
    :   Returns a numpy array of metadata values obtained by extracting `key`
        from each metadata entry, and using `default_value` if the key is
        not present. `key` may be a list, in which case nested values are returned.
        For instance, `key = ["a", "x"]` will return an array of
        `row.metadata["a"]["x"]` values, iterated over rows in this table.

        Parameters:
        :   - **key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The name, or a list of names, of metadata entries.
            - **dtype** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The dtype of the result (can usually be omitted).
            - **default\_value** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – The value to be inserted if the metadata key
              is not present. Note that for numeric columns, a default value of None
              will result in a non-numeric array. The default behaviour is to raise
              `KeyError` on missing entries.

    *property* nbytes[#](#tskit.MutationTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    packset\_metadata(*metadatas*)[#](#tskit.MutationTable.packset_metadata "Link to this definition")
    :   Packs the specified list of metadata values and updates the `metadata`
        and `metadata_offset` columns. The length of the metadatas array
        must be equal to the number of rows in the table.

        Parameters:
        :   **metadatas** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of metadata bytes values.

    truncate(*num\_rows*)[#](#tskit.MutationTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#id14 "Link to this heading")

A row returned from a [`MutationTable`](#tskit.MutationTable "tskit.MutationTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Mutation`](#tskit.Mutation "tskit.Mutation") class.

*class* tskit.MutationTableRow[[source]](_modules/tskit/tables.html#MutationTableRow)[#](#tskit.MutationTableRow "Link to this definition")
:   A row in a [`MutationTable`](#tskit.MutationTable "tskit.MutationTable").

    site[#](#tskit.MutationTableRow.site "Link to this definition")
    :   See [`Mutation.site`](#tskit.Mutation.site "tskit.Mutation.site")

    node[#](#tskit.MutationTableRow.node "Link to this definition")
    :   See [`Mutation.node`](#tskit.Mutation.node "tskit.Mutation.node")

    derived\_state[#](#tskit.MutationTableRow.derived_state "Link to this definition")
    :   See [`Mutation.derived_state`](#tskit.Mutation.derived_state "tskit.Mutation.derived_state")

    parent[#](#tskit.MutationTableRow.parent "Link to this definition")
    :   See [`Mutation.parent`](#tskit.Mutation.parent "tskit.Mutation.parent")

    metadata[#](#tskit.MutationTableRow.metadata "Link to this definition")
    :   See [`Mutation.metadata`](#tskit.Mutation.metadata "tskit.Mutation.metadata")

    time[#](#tskit.MutationTableRow.time "Link to this definition")
    :   See [`Mutation.time`](#tskit.Mutation.time "tskit.Mutation.time")

    asdict(*\*\*kwargs*)[#](#tskit.MutationTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.MutationTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

#### [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable") classes[#](#populationtable-classes "Link to this heading")

*class* tskit.PopulationTable[[source]](_modules/tskit/tables.html#PopulationTable)[#](#tskit.PopulationTable "Link to this definition")
:   A table defining the populations referred to in a tree sequence.
    The PopulationTable stores metadata for populations that may be referred to
    in the NodeTable and MigrationTable”. Note that although nodes
    may be associated with populations, this association is stored in
    the [`NodeTable`](#tskit.NodeTable "tskit.NodeTable"): only metadata on each population is stored
    in the population table.

    Warning

    The numpy arrays returned by table attribute accesses are copies
    of the underlying data. In particular, this means that editing
    individual values in the arrays will not change the table data
    Instead, you should set entire columns or rows at once
    (see [Accessing table data](#sec-tables-api-accessing-table-data)).

    Variables:
    :   - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array of binary metadata values. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the metadata column. See
          [Binary columns](#sec-tables-api-binary-columns) for more details.
        - **metadata\_schema** ([*tskit.MetadataSchema*](#tskit.MetadataSchema "tskit.MetadataSchema")) – The metadata schema for this table’s metadata column

    add\_row(*metadata=None*)[[source]](_modules/tskit/tables.html#PopulationTable.add_row)[#](#tskit.PopulationTable.add_row "Link to this definition")
    :   Adds a new row to this [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable") and returns the ID of the
        corresponding population. Metadata, if specified, will be validated and encoded
        according to the table’s
        [`metadata_schema`](#tskit.PopulationTable.metadata_schema "tskit.PopulationTable.metadata_schema").

        Parameters:
        :   **metadata** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – Any object that is valid metadata for the table’s schema.
            Defaults to the default metadata value for the table’s schema. This is
            typically `{}`. For no schema, `None`.

        Returns:
        :   The ID of the newly added population.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    set\_columns(*metadata=None*, *metadata\_offset=None*, *metadata\_schema=None*)[[source]](_modules/tskit/tables.html#PopulationTable.set_columns)[#](#tskit.PopulationTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable") using the
        values in the specified arrays. Overwrites existing data in all the table
        columns.

        The `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information) and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.
            - **metadata\_schema** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The encoded metadata schema. If None (default)
              do not overwrite the exising schema. Note that a schema will need to be
              encoded as a string, e.g. via `repr(new_metadata_schema)`.

    append\_columns(*metadata=None*, *metadata\_offset=None*)[[source]](_modules/tskit/tables.html#PopulationTable.append_columns)[#](#tskit.PopulationTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns of this
        [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable"). This allows many new rows to be added at once.

        The `metadata` and `metadata_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information) and
        [Metadata for bulk table methods](https://tskit.dev/tutorials/metadata.html#sec-tutorial-metadata-bulk "(in Project name not set)") for an example of how to prepare metadata.

        Parameters:
        :   - **metadata** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened metadata array. Must be specified along
              with `metadata_offset`. If not specified or None, an empty metadata
              value is stored for each node.
            - **metadata\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `metadata` array.

    \_\_getitem\_\_(*index*)[#](#tskit.PopulationTable.__getitem__ "Link to this definition")
    :   If passed an integer, return the specified row of this table, decoding metadata
        if it is present. Supports negative indexing, e.g. `table[-5]`.
        If passed a slice, iterable or array return a new table containing the specified
        rows. Similar to numpy fancy indexing, if the array or iterables contains
        booleans then the index acts as a mask, returning those rows for which the mask
        is True. Note that as the result is a new table, the row ids will change as tskit
        row ids are row indexes.

        Parameters:
        :   **index** – the index of a desired row, a slice of the desired rows, an
            iterable or array of the desired row numbers, or a boolean array to use as
            a mask.

    append(*row*)[#](#tskit.PopulationTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.PopulationTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    assert\_equals(*other*, *\**, *ignore\_metadata=False*)[#](#tskit.PopulationTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another table of the same type.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

    clear()[#](#tskit.PopulationTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.PopulationTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    drop\_metadata(*\**, *keep\_schema=False*)[#](#tskit.PopulationTable.drop_metadata "Link to this definition")
    :   Drops all metadata in this table. By default, the schema is also cleared,
        except if `keep_schema` is True.

        Parameters:
        :   **keep\_schema** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – True if the current schema should be kept intact.

    equals(*other*, *ignore\_metadata=False*)[#](#tskit.PopulationTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two tables
        are considered equal if their columns and metadata schemas are
        byte-for-byte identical.

        Parameters:
        :   - **other** – Another table instance
            - **ignore\_metadata** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude metadata and metadata schemas
              from the comparison.

        Returns:
        :   True if other is equal to this table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    keep\_rows(*keep*)[#](#tskit.PopulationTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* metadata\_schema[#](#tskit.PopulationTable.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this table.

    metadata\_vector(*key*, *\**, *dtype=None*, *default\_value=<object object>*)[#](#tskit.PopulationTable.metadata_vector "Link to this definition")
    :   Returns a numpy array of metadata values obtained by extracting `key`
        from each metadata entry, and using `default_value` if the key is
        not present. `key` may be a list, in which case nested values are returned.
        For instance, `key = ["a", "x"]` will return an array of
        `row.metadata["a"]["x"]` values, iterated over rows in this table.

        Parameters:
        :   - **key** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The name, or a list of names, of metadata entries.
            - **dtype** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – The dtype of the result (can usually be omitted).
            - **default\_value** ([*object*](https://docs.python.org/3/library/functions.html#object "(in Python v3.14)")) – The value to be inserted if the metadata key
              is not present. Note that for numeric columns, a default value of None
              will result in a non-numeric array. The default behaviour is to raise
              `KeyError` on missing entries.

    *property* nbytes[#](#tskit.PopulationTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    packset\_metadata(*metadatas*)[#](#tskit.PopulationTable.packset_metadata "Link to this definition")
    :   Packs the specified list of metadata values and updates the `metadata`
        and `metadata_offset` columns. The length of the metadatas array
        must be equal to the number of rows in the table.

        Parameters:
        :   **metadatas** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")) – A list of metadata bytes values.

    truncate(*num\_rows*)[#](#tskit.PopulationTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#id15 "Link to this heading")

A row returned from a [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Population`](#tskit.Population "tskit.Population") class.

*class* tskit.PopulationTableRow[[source]](_modules/tskit/tables.html#PopulationTableRow)[#](#tskit.PopulationTableRow "Link to this definition")
:   A row in a [`PopulationTable`](#tskit.PopulationTable "tskit.PopulationTable").

    metadata[#](#tskit.PopulationTableRow.metadata "Link to this definition")
    :   See [`Population.metadata`](#tskit.Population.metadata "tskit.Population.metadata")

    asdict(*\*\*kwargs*)[#](#tskit.PopulationTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.PopulationTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

#### [`ProvenanceTable`](#tskit.ProvenanceTable "tskit.ProvenanceTable") classes[#](#provenancetable-classes "Link to this heading")

Also see the [Provenance](provenance.html#sec-provenance) and
[provenance API methods](#sec-python-api-provenance).

*class* tskit.ProvenanceTable[[source]](_modules/tskit/tables.html#ProvenanceTable)[#](#tskit.ProvenanceTable "Link to this definition")
:   A table recording the provenance (i.e., history) of this table, so that the
    origin of the underlying data and sequence of subsequent operations can be
    traced. Each row contains a “record” string (recommended format: JSON) and
    a timestamp.

    Todo

    The format of the record field will be more precisely specified in
    the future.

    Variables:
    :   - **record** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array containing the record strings.
          [Text columns](#sec-tables-api-text-columns) for more details.
        - **record\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the record column. See
          [Text columns](#sec-tables-api-text-columns) for more details.
        - **timestamp** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened array containing the timestamp strings.
          [Text columns](#sec-tables-api-text-columns) for more details.
        - **timestamp\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32*) – The array of offsets into the timestamp column. See
          [Text columns](#sec-tables-api-text-columns) for more details.

    add\_row(*record*, *timestamp=None*)[[source]](_modules/tskit/tables.html#ProvenanceTable.add_row)[#](#tskit.ProvenanceTable.add_row "Link to this definition")
    :   Adds a new row to this ProvenanceTable consisting of the specified record and
        timestamp. If timestamp is not specified, it is automatically generated from
        the current time.

        Parameters:
        :   - **record** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A provenance record, describing the parameters and
              environment used to generate the current set of tables.
            - **timestamp** ([*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")) – A string timestamp. This should be in ISO8601 form.

    set\_columns(*timestamp=None*, *timestamp\_offset=None*, *record=None*, *record\_offset=None*)[[source]](_modules/tskit/tables.html#ProvenanceTable.set_columns)[#](#tskit.ProvenanceTable.set_columns "Link to this definition")
    :   Sets the values for each column in this [`ProvenanceTable`](#tskit.ProvenanceTable "tskit.ProvenanceTable") using the
        values in the specified arrays. Overwrites existing data in all the table
        columns.

        The `timestamp` and `timestamp_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information). Likewise
        for the `record` and `record_offset` columns

        Parameters:
        :   - **timestamp** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened timestamp array. Must be specified along
              with `timestamp_offset`. If not specified or None, an empty timestamp
              value is stored for each node.
            - **timestamp\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `timestamp` array.
            - **record** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened record array. Must be specified along
              with `record_offset`. If not specified or None, an empty record
              value is stored for each node.
            - **record\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `record` array.

    append\_columns(*timestamp=None*, *timestamp\_offset=None*, *record=None*, *record\_offset=None*)[[source]](_modules/tskit/tables.html#ProvenanceTable.append_columns)[#](#tskit.ProvenanceTable.append_columns "Link to this definition")
    :   Appends the specified arrays to the end of the columns of this
        [`ProvenanceTable`](#tskit.ProvenanceTable "tskit.ProvenanceTable"). This allows many new rows to be added at once.

        The `timestamp` and `timestamp_offset` parameters must be supplied
        together, and meet the requirements for
        [Encoding ragged columns](data-model.html#sec-encoding-ragged-columns) (see
        [Binary columns](#sec-tables-api-binary-columns) for more information). Likewise
        for the `record` and `record_offset` columns

        Parameters:
        :   - **timestamp** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened timestamp array. Must be specified along
              with `timestamp_offset`. If not specified or None, an empty timestamp
              value is stored for each node.
            - **timestamp\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `timestamp` array.
            - **record** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.int8*) – The flattened record array. Must be specified along
              with `record_offset`. If not specified or None, an empty record
              value is stored for each node.
            - **record\_offset** ([*numpy.ndarray*](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")*,* *dtype=np.uint32.*) – The offsets into the `record` array.

    packset\_record(*records*)[[source]](_modules/tskit/tables.html#ProvenanceTable.packset_record)[#](#tskit.ProvenanceTable.packset_record "Link to this definition")
    :   Packs the specified list of record values and updates the
        `record` and `record_offset` columns. The length
        of the records array must be equal to the number of rows in
        the table.

        Parameters:
        :   **records** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*(*[*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – A list of string record values.

    packset\_timestamp(*timestamps*)[[source]](_modules/tskit/tables.html#ProvenanceTable.packset_timestamp)[#](#tskit.ProvenanceTable.packset_timestamp "Link to this definition")
    :   Packs the specified list of timestamp values and updates the
        `timestamp` and `timestamp_offset` columns. The length
        of the timestamps array must be equal to the number of rows in
        the table.

        Parameters:
        :   **timestamps** ([*list*](https://docs.python.org/3/library/stdtypes.html#list "(in Python v3.14)")*(*[*str*](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)")*)*) – A list of string timestamp values.

    equals(*other*, *ignore\_timestamps=False*)[[source]](_modules/tskit/tables.html#ProvenanceTable.equals)[#](#tskit.ProvenanceTable.equals "Link to this definition")
    :   Returns True if self and other are equal. By default, two provenance
        tables are considered equal if their columns are byte-for-byte identical.

        Parameters:
        :   - **other** – Another provenance table instance
            - **ignore\_timestamps** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude the timestamp column
              from the comparison.

        Returns:
        :   True if other is equal to this provenance table; False otherwise.

        Return type:
        :   [bool](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    assert\_equals(*other*, *\**, *ignore\_timestamps=False*)[[source]](_modules/tskit/tables.html#ProvenanceTable.assert_equals)[#](#tskit.ProvenanceTable.assert_equals "Link to this definition")
    :   Raise an AssertionError for the first found difference between
        this and another provenance table.

        Parameters:
        :   - **other** – Another provenance table instance
            - **ignore\_timestamps** ([*bool*](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")) – If True exclude the timestamp column
              from the comparison.

    append(*row*)[#](#tskit.ProvenanceTable.append "Link to this definition")
    :   Adds a new row to this table and returns the ID of the new row. Metadata, if
        specified, will be validated and encoded according to the table’s
        [`metadata_schema`](#tskit.IndividualTable.metadata_schema "tskit.IndividualTable.metadata_schema").

        Parameters:
        :   **row** (*row-like*) – An object that has attributes corresponding to the
            properties of the new row. Both the objects returned from `table[i]` and
            e.g. `ts.individual(i)` work for this purpose, along with any other
            object with the correct attributes.

        Returns:
        :   The index of the newly added row.

        Return type:
        :   [int](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")

    asdict()[#](#tskit.ProvenanceTable.asdict "Link to this definition")
    :   Returns a dictionary mapping the names of the columns in this table
        to the corresponding numpy arrays.

    clear()[#](#tskit.ProvenanceTable.clear "Link to this definition")
    :   Deletes all rows in this table.

    copy()[#](#tskit.ProvenanceTable.copy "Link to this definition")
    :   Returns a deep copy of this table

    keep\_rows(*keep*)[#](#tskit.ProvenanceTable.keep_rows "Link to this definition")
    :   Updates this table in-place according to the specified boolean
        array, and returns the resulting mapping from old to new row IDs.
        For each row `j`, if `keep[j]` is True, that row will be
        retained in the output; otherwise, the row will be deleted.
        Rows are retained in their original ordering.

        The returned `id_map` is an array of the same length as
        this table before the operation, such that `id_map[j] = -1`
        ([`tskit.NULL`](#tskit.NULL "tskit.NULL")) if row `j` was deleted, and `id_map[j]`
        is the new ID of that row, otherwise.

        Todo

        This needs some examples to link to. See
        [tskit-dev/tskit#2708](https://github.com/tskit-dev/tskit/issues/2708)

        Parameters:
        :   **keep** (*array-like*) – The rows to keep as a boolean array. Must
            be the same length as the table, and convertible to a numpy
            array of dtype bool.

        Returns:
        :   The mapping between old and new row IDs as a numpy
            array (dtype int32).

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)") (dtype=np.int32)

    *property* nbytes[#](#tskit.ProvenanceTable.nbytes "Link to this definition")
    :   Returns the total number of bytes required to store the data
        in this table. Note that this may not be equal to
        the actual memory footprint.

    truncate(*num\_rows*)[#](#tskit.ProvenanceTable.truncate "Link to this definition")
    :   Truncates this table so that the only the first `num_rows` are retained.

        Parameters:
        :   **num\_rows** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The number of rows to retain in this table.

##### Associated row class[#](#id16 "Link to this heading")

A row returned from a [`ProvenanceTable`](#tskit.ProvenanceTable "tskit.ProvenanceTable") is an instance of the following
basic class, where each attribute matches an identically named attribute in the
[`Provenance`](#tskit.Provenance "tskit.Provenance") class.

*class* tskit.ProvenanceTableRow(*timestamp*, *record*)[[source]](_modules/tskit/tables.html#ProvenanceTableRow)[#](#tskit.ProvenanceTableRow "Link to this definition")
:   A row in a [`ProvenanceTable`](#tskit.ProvenanceTable "tskit.ProvenanceTable").

    timestamp[#](#tskit.ProvenanceTableRow.timestamp "Link to this definition")
    :   See [`Provenance.timestamp`](#tskit.Provenance.timestamp "tskit.Provenance.timestamp")

    record[#](#tskit.ProvenanceTableRow.record "Link to this definition")
    :   See [`Provenance.record`](#tskit.Provenance.record "tskit.Provenance.record")

    asdict(*\*\*kwargs*)[#](#tskit.ProvenanceTableRow.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    replace(*\*\*kwargs*)[#](#tskit.ProvenanceTableRow.replace "Link to this definition")
    :   Return a new instance of this dataclass, with the specified attributes
        overwritten by new values.

        Returns:
        :   A new instance of the same type

### Identity classes[#](#sec-python-api-reference-identity "Link to this heading")

The classes documented in this section are associated with summarising
identity relationships between pairs of samples. See the [Identity by descent](ibd.html#sec-identity)
section for more details and examples.

#### The [`IdentitySegments`](#tskit.IdentitySegments "tskit.IdentitySegments") class[#](#the-identitysegments-class "Link to this heading")

*class* tskit.IdentitySegments[[source]](_modules/tskit/tables.html#IdentitySegments)[#](#tskit.IdentitySegments "Link to this definition")
:   A class summarising and optionally storing the segments of identity
    by state returned by [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments"). See the
    [Identity by descent](ibd.html#sec-identity) for more information and examples.

    Along with the documented methods and attributes, the class supports
    the Python mapping protocol, and can be regarded as a dictionary
    mapping sample node pair tuples to the corresponding
    [`IdentitySegmentList`](#tskit.IdentitySegmentList "tskit.IdentitySegmentList").

    Note

    It is important to note that the facilities available
    for a given instance of this class are determined by the
    `store_pairs` and `store_segments` arguments provided to
    [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments"). For example, attempting
    to access per-sample pair information if `store_pairs`
    is False will result in a (hopefully informative) error being
    raised.

    Warning

    This class should not be instantiated directly.

    *property* num\_segments[#](#tskit.IdentitySegments.num_segments "Link to this definition")
    :   The total number of identity segments found.

    *property* num\_pairs[#](#tskit.IdentitySegments.num_pairs "Link to this definition")
    :   The total number of distinct sample pairs for which identity
        segments were found. (Only available when `store_pairs` or
        `store_segments` is specified).

    *property* total\_span[#](#tskit.IdentitySegments.total_span "Link to this definition")
    :   The total genomic sequence length spanned by all identity
        segments that were found.

    *property* pairs[#](#tskit.IdentitySegments.pairs "Link to this definition")
    :   A numpy array with shape `(segs.num_pairs, 2)` and dtype=np.int32
        containing the sample pairs for which IBD segments were found.

#### The [`IdentitySegmentList`](#tskit.IdentitySegmentList "tskit.IdentitySegmentList") class[#](#the-identitysegmentlist-class "Link to this heading")

*class* tskit.IdentitySegmentList[[source]](_modules/tskit/tables.html#IdentitySegmentList)[#](#tskit.IdentitySegmentList "Link to this definition")
:   A summary of identity segments for some pair of samples in a
    [`IdentitySegments`](#tskit.IdentitySegments "tskit.IdentitySegments") result. If the `store_segments` argument
    has been specified to [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments "tskit.TreeSequence.ibd_segments"), this class
    can be treated as a sequence of [`IdentitySegment`](#tskit.IdentitySegment "tskit.IdentitySegment") objects.

    Access to the segment data via numpy arrays is also available via
    the [`IdentitySegmentList.left`](#tskit.IdentitySegmentList.left "tskit.IdentitySegmentList.left"), [`IdentitySegmentList.right`](#tskit.IdentitySegmentList.right "tskit.IdentitySegmentList.right")
    and [`IdentitySegmentList.node`](#tskit.IdentitySegmentList.node "tskit.IdentitySegmentList.node") attributes.

    If `store_segments` is False, only the overall summary values
    such as [`IdentitySegmentList.total_span`](#tskit.IdentitySegmentList.total_span "tskit.IdentitySegmentList.total_span") and `len()` are
    available.

    Warning

    The order of segments within an IdentitySegmentList is
    arbitrary and may change in the future

    *property* total\_span[#](#tskit.IdentitySegmentList.total_span "Link to this definition")
    :   The total genomic span covered by segments in this list. Equal to
        `sum(seg.span for seg in seglst)`.

    *property* left[#](#tskit.IdentitySegmentList.left "Link to this definition")
    :   A numpy array (dtype=np.float64) of the `left` coordinates of segments.

    *property* right[#](#tskit.IdentitySegmentList.right "Link to this definition")
    :   A numpy array (dtype=np.float64) of the `right` coordinates of segments.

    *property* node[#](#tskit.IdentitySegmentList.node "Link to this definition")
    :   A numpy array (dtype=np.int32) of the MRCA node IDs in segments.

#### The [`IdentitySegment`](#tskit.IdentitySegment "tskit.IdentitySegment") class[#](#the-identitysegment-class "Link to this heading")

*class* tskit.IdentitySegment(*left*, *right*, *node*)[[source]](_modules/tskit/tables.html#IdentitySegment)[#](#tskit.IdentitySegment "Link to this definition")
:   A single segment of identity spanning a genomic interval for a
    a specific ancestor node.

    left[#](#tskit.IdentitySegment.left "Link to this definition")
    :   The left genomic coordinate (inclusive).

    right[#](#tskit.IdentitySegment.right "Link to this definition")
    :   The right genomic coordinate (exclusive).

    node[#](#tskit.IdentitySegment.node "Link to this definition")
    :   The ID of the most recent common ancestor node.

    *property* span[#](#tskit.IdentitySegment.span "Link to this definition")
    :   The length of the genomic region spanned by this identity segment.

### Miscellaneous classes[#](#miscellaneous-classes "Link to this heading")

#### The [`ReferenceSequence`](#tskit.ReferenceSequence "tskit.ReferenceSequence") class[#](#the-referencesequence-class "Link to this heading")

Todo

Add a top-level summary section that we can link to from here.

*class* tskit.ReferenceSequence[[source]](_modules/tskit/tables.html#ReferenceSequence)[#](#tskit.ReferenceSequence "Link to this definition")
:   The [reference sequence](data-model.html#sec-data-model-reference-sequence) associated
    with a given [`TableCollection`](#tskit.TableCollection "tskit.TableCollection") or [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence").

    Metadata concerning reference sequences can be described using the
    [`metadata_schema`](#tskit.ReferenceSequence.metadata_schema "tskit.ReferenceSequence.metadata_schema") and stored in the [`metadata`](#tskit.ReferenceSequence.metadata "tskit.ReferenceSequence.metadata") attribute.
    See the [examples](metadata.html#sec-metadata-examples-reference-sequence) for
    idiomatic usage.

    Warning

    This API is preliminary and currently only supports accessing
    reference sequence information via the `.data` attribute. Future versions
    will also enable transparent fetching of known reference sequences
    from a URL (see [tskit-dev/tskit#2022](https://github.com/tskit-dev/tskit/issues/2022)).

    is\_null()[[source]](_modules/tskit/tables.html#ReferenceSequence.is_null)[#](#tskit.ReferenceSequence.is_null "Link to this definition")
    :   Returns True if this [`ReferenceSequence`](#tskit.ReferenceSequence "tskit.ReferenceSequence") is null, i.e.,
        all fields are empty.

        Return type:
        :   [`bool`](https://docs.python.org/3/library/functions.html#bool "(in Python v3.14)")

    *property* data[#](#tskit.ReferenceSequence.data "Link to this definition")
    :   The string encoding of the reference sequence such that `data[j]`
        represents the reference nucleotide at base `j`. If this reference
        sequence is writable, the value can be assigned, e.g.
        `tables.reference_sequence.data = "ACGT"`

    *property* metadata[#](#tskit.ReferenceSequence.metadata "Link to this definition")
    :   The decoded metadata for this object.

    *property* metadata\_bytes[#](#tskit.ReferenceSequence.metadata_bytes "Link to this definition")
    :   The raw bytes of metadata for this TableCollection

    *property* metadata\_schema[#](#tskit.ReferenceSequence.metadata_schema "Link to this definition")
    :   The [`tskit.MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") for this object.

#### The [`MetadataSchema`](#tskit.MetadataSchema "tskit.MetadataSchema") class[#](#the-metadataschema-class "Link to this heading")

Also see the [Metadata API](#sec-python-api-metadata) summary.

*class* tskit.MetadataSchema(*schema*)[[source]](_modules/tskit/metadata.html#MetadataSchema)[#](#tskit.MetadataSchema "Link to this definition")
:   Class for validating, encoding and decoding metadata.

    Parameters:
    :   **schema** ([*dict*](https://docs.python.org/3/library/stdtypes.html#dict "(in Python v3.14)")) – A dict containing a valid JSONSchema object.

    asdict()[[source]](_modules/tskit/metadata.html#MetadataSchema.asdict)[#](#tskit.MetadataSchema.asdict "Link to this definition")
    :   Returns a dict representation of this schema. One possible use of this is to
        modify this dict and then pass it to the `MetadataSchema` constructor to create
        a similar schema.

        Return type:
        :   [`Optional`](https://docs.python.org/3/library/typing.html#typing.Optional "(in Python v3.14)")[[`Mapping`](https://docs.python.org/3/library/typing.html#typing.Mapping "(in Python v3.14)")[[`str`](https://docs.python.org/3/library/stdtypes.html#str "(in Python v3.14)"), [`Any`](https://docs.python.org/3/library/typing.html#typing.Any "(in Python v3.14)")]]

    validate\_and\_encode\_row(*row*)[[source]](_modules/tskit/metadata.html#MetadataSchema.validate_and_encode_row)[#](#tskit.MetadataSchema.validate_and_encode_row "Link to this definition")
    :   Validate a row (dict) of metadata against this schema and return the encoded
        representation (bytes) using the codec specified in the schema.

        Return type:
        :   [`bytes`](https://docs.python.org/3/library/stdtypes.html#bytes "(in Python v3.14)")

    decode\_row(*row*)[[source]](_modules/tskit/metadata.html#MetadataSchema.decode_row)[#](#tskit.MetadataSchema.decode_row "Link to this definition")
    :   Decode an encoded row (bytes) of metadata, using the codec specifed in the schema
        and return a python dict. Note that no validation of the metadata against the
        schema is performed.

        Return type:
        :   [`Any`](https://docs.python.org/3/library/typing.html#typing.Any "(in Python v3.14)")

    encode\_row(*row*)[[source]](_modules/tskit/metadata.html#MetadataSchema.encode_row)[#](#tskit.MetadataSchema.encode_row "Link to this definition")
    :   Encode a row (dict) of metadata to its binary representation (bytes)
        using the codec specified in the schema. Note that unlike
        [`validate_and_encode_row()`](#tskit.MetadataSchema.validate_and_encode_row "tskit.MetadataSchema.validate_and_encode_row") no validation against the schema is performed.
        This should only be used for performance if a validation check is not needed.

        Return type:
        :   [`bytes`](https://docs.python.org/3/library/stdtypes.html#bytes "(in Python v3.14)")

    structured\_array\_from\_buffer(*buffer*)[[source]](_modules/tskit/metadata.html#MetadataSchema.structured_array_from_buffer)[#](#tskit.MetadataSchema.structured_array_from_buffer "Link to this definition")
    :   Convert a buffer of metadata into a structured NumPy array.

        Return type:
        :   [`Any`](https://docs.python.org/3/library/typing.html#typing.Any "(in Python v3.14)")

    *static* permissive\_json()[[source]](_modules/tskit/metadata.html#MetadataSchema.permissive_json)[#](#tskit.MetadataSchema.permissive_json "Link to this definition")
    :   The simplest, permissive JSON schema. Only specifies the JSON codec and has
        no constraints on the properties.

    *static* null()[[source]](_modules/tskit/metadata.html#MetadataSchema.null)[#](#tskit.MetadataSchema.null "Link to this definition")
    :   The null schema which defines no properties and results in raw bytes
        being returned on accessing metadata column.

#### The [`TableMetadataSchemas`](#tskit.TableMetadataSchemas "tskit.TableMetadataSchemas") class[#](#the-tablemetadataschemas-class "Link to this heading")

*class* tskit.TableMetadataSchemas(*node=None*, *edge=None*, *site=None*, *mutation=None*, *migration=None*, *individual=None*, *population=None*)[[source]](_modules/tskit/trees.html#TableMetadataSchemas)[#](#tskit.TableMetadataSchemas "Link to this definition")
:   Convenience class for returning the schemas of all the tables in a tree sequence.

    node *= None*[#](#tskit.TableMetadataSchemas.node "Link to this definition")
    :   The metadata schema of the node table.

    edge *= None*[#](#tskit.TableMetadataSchemas.edge "Link to this definition")
    :   The metadata schema of the edge table.

    site *= None*[#](#tskit.TableMetadataSchemas.site "Link to this definition")
    :   The metadata schema of the site table.

    mutation *= None*[#](#tskit.TableMetadataSchemas.mutation "Link to this definition")
    :   The metadata schema of the mutation table.

    migration *= None*[#](#tskit.TableMetadataSchemas.migration "Link to this definition")
    :   The metadata schema of the migration table.

    individual *= None*[#](#tskit.TableMetadataSchemas.individual "Link to this definition")
    :   The metadata schema of the individual table.

    population *= None*[#](#tskit.TableMetadataSchemas.population "Link to this definition")
    :   The metadata schema of the population table.

#### The [`TopologyCounter`](#tskit.TopologyCounter "tskit.TopologyCounter") class[#](#the-topologycounter-class "Link to this heading")

*class* tskit.TopologyCounter[[source]](_modules/tskit/combinatorics.html#TopologyCounter)[#](#tskit.TopologyCounter "Link to this definition")
:   Contains the distributions of embedded topologies for every combination
    of the sample sets used to generate the `TopologyCounter`. It is
    indexable by a combination of sample set indexes and returns a
    `collections.Counter` whose keys are topology ranks
    (see [Interpreting Tree Ranks](topological-analysis.html#sec-tree-ranks)). See [`Tree.count_topologies()`](#tskit.Tree.count_topologies "tskit.Tree.count_topologies") for more
    detail on how this structure is used.

#### The [`LdCalculator`](#tskit.LdCalculator "tskit.LdCalculator") class[#](#the-ldcalculator-class "Link to this heading")

*class* tskit.LdCalculator(*tree\_sequence*)[[source]](_modules/tskit/stats.html#LdCalculator)[#](#tskit.LdCalculator "Link to this definition")
:   Class for calculating [linkage disequilibrium](https://en.wikipedia.org/wiki/Linkage_disequilibrium) coefficients
    between pairs of sites in a [`TreeSequence`](#tskit.TreeSequence "tskit.TreeSequence").

    Note

    This interface is deprecated and a replacement is planned.
    Please see [tskit-dev/tskit#1900](https://github.com/tskit-dev/tskit/issues/1900) for
    more information. Note also that the current implementation is
    quite limited (see warning below).

    Warning

    This class does not currently support sites that have more than one
    mutation. Using it on such a tree sequence will raise a LibraryError with
    an “Only infinite sites mutations supported” message.

    Silent mutations are also not supported and will result in a LibraryError.

    Parameters:
    :   **tree\_sequence** ([*TreeSequence*](#tskit.TreeSequence "tskit.TreeSequence")) – The tree sequence of interest.

    r2(*a*, *b*)[[source]](_modules/tskit/stats.html#LdCalculator.r2)[#](#tskit.LdCalculator.r2 "Link to this definition")
    :   Returns the value of the \(r^2\) statistic between the pair of
        sites at the specified indexes. This method is *not* an efficient
        method for computing large numbers of pairwise LD values; please use either
        [`r2_array()`](#tskit.LdCalculator.r2_array "tskit.LdCalculator.r2_array") or [`r2_matrix()`](#tskit.LdCalculator.r2_matrix "tskit.LdCalculator.r2_matrix") for this purpose.

        Parameters:
        :   - **a** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The index of the first site.
            - **b** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The index of the second site.

        Returns:
        :   The value of \(r^2\) between the sites at indexes
            `a` and `b`.

        Return type:
        :   [float](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")

    r2\_array(*a*, *direction=1*, *max\_mutations=None*, *max\_distance=None*, *max\_sites=None*)[[source]](_modules/tskit/stats.html#LdCalculator.r2_array)[#](#tskit.LdCalculator.r2_array "Link to this definition")
    :   Returns the value of the \(r^2\) statistic between the focal
        site at index \(a\) and a set of other sites. The method
        operates by starting at the focal site and iterating over adjacent
        sites (in either the forward or backwards direction) until either a
        maximum number of other sites have been considered (using the
        `max_sites` parameter), a maximum distance in sequence
        coordinates has been reached (using the `max_distance` parameter) or
        the start/end of the sequence has been reached. For every site
        \(b\) considered, we then insert the value of \(r^2\) between
        \(a\) and \(b\) at the corresponding index in an array, and
        return the entire array. If the returned array is \(x\) and
        `direction` is [`tskit.FORWARD`](#tskit.FORWARD "tskit.FORWARD") then \(x[0]\) is the
        value of the statistic for \(a\) and \(a + 1\), \(x[1]\)
        the value for \(a\) and \(a + 2\), etc. Similarly, if
        `direction` is [`tskit.REVERSE`](#tskit.REVERSE "tskit.REVERSE") then \(x[0]\) is the
        value of the statistic for \(a\) and \(a - 1\), \(x[1]\)
        the value for \(a\) and \(a - 2\), etc.

        Parameters:
        :   - **a** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The index of the focal sites.
            - **direction** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The direction in which to travel when
              examining other sites. Must be either
              [`tskit.FORWARD`](#tskit.FORWARD "tskit.FORWARD") or [`tskit.REVERSE`](#tskit.REVERSE "tskit.REVERSE"). Defaults
              to [`tskit.FORWARD`](#tskit.FORWARD "tskit.FORWARD").
            - **max\_sites** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – The maximum number of sites to return
              \(r^2\) values for. Defaults to as many sites as
              possible.
            - **max\_mutations** ([*int*](https://docs.python.org/3/library/functions.html#int "(in Python v3.14)")) – Deprecated synonym for max\_sites.
            - **max\_distance** ([*float*](https://docs.python.org/3/library/functions.html#float "(in Python v3.14)")) – The maximum absolute distance between
              the focal sites and those for which \(r^2\) values
              are returned.

        Returns:
        :   An array of double precision floating point values
            representing the \(r^2\) values for sites in the
            specified direction.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")

    r2\_matrix()[[source]](_modules/tskit/stats.html#LdCalculator.r2_matrix)[#](#tskit.LdCalculator.r2_matrix "Link to this definition")
    :   Returns the complete \(m \times m\) matrix of pairwise
        \(r^2\) values in a tree sequence with \(m\) sites.

        Returns:
        :   An 2 dimensional square array of double precision
            floating point values representing the \(r^2\) values for
            all pairs of sites.

        Return type:
        :   [numpy.ndarray](https://numpy.org/doc/stable/reference/generated/numpy.ndarray.html#numpy.ndarray "(in NumPy v2.3)")

#### The [`TableCollectionIndexes`](#tskit.TableCollectionIndexes "tskit.TableCollectionIndexes") class[#](#the-tablecollectionindexes-class "Link to this heading")

*class* tskit.TableCollectionIndexes(*edge\_insertion\_order=None*, *edge\_removal\_order=None*)[[source]](_modules/tskit/tables.html#TableCollectionIndexes)[#](#tskit.TableCollectionIndexes "Link to this definition")
:   A class encapsulating the indexes of a [`TableCollection`](#tskit.TableCollection "tskit.TableCollection")

    asdict()[[source]](_modules/tskit/tables.html#TableCollectionIndexes.asdict)[#](#tskit.TableCollectionIndexes.asdict "Link to this definition")
    :   Return a new dict which maps field names to their corresponding values
        in this dataclass.

    *property* nbytes[#](#tskit.TableCollectionIndexes.nbytes "Link to this definition")
    :   The number of bytes taken by the indexes

#### The [`SVGString`](#tskit.SVGString "tskit.SVGString") class[#](#the-svgstring-class "Link to this heading")

*class* tskit.SVGString[[source]](_modules/tskit/drawing.html#SVGString)[#](#tskit.SVGString "Link to this definition")
:   A string containing an SVG representation

    \_repr\_svg\_()[[source]](_modules/tskit/drawing.html#SVGString._repr_svg_)[#](#tskit.SVGString._repr_svg_ "Link to this definition")
    :   Simply return the SVG string: called by jupyter notebooks to render trees.

#### The [`PCAResult`](#tskit.PCAResult "tskit.PCAResult") class[#](#the-pcaresult-class "Link to this heading")

*class* tskit.PCAResult(*factors*, *eigenvalues*, *range\_sketch*, *error\_bound*)[[source]](_modules/tskit/trees.html#PCAResult)[#](#tskit.PCAResult "Link to this definition")
:   The result of a call to TreeSequence.pca() capturing the output values
    and algorithm convergence details.

    factors[#](#tskit.PCAResult.factors "Link to this definition")
    :   The principal component factors (or scores).
        Columns are orthogonal, with one entry per sample
        or individual (see [`pca`](#tskit.TreeSequence.pca "tskit.TreeSequence.pca")).
        This is the same as the loadings because the GRM is symmetric.

    eigenvalues[#](#tskit.PCAResult.eigenvalues "Link to this definition")
    :   Eigenvalues of the genetic relatedness matrix.

    range\_sketch[#](#tskit.PCAResult.range_sketch "Link to this definition")
    :   Range sketch matrix. Can be used as an input for
        [`pca`](#tskit.TreeSequence.pca "tskit.TreeSequence.pca") option to further improve precision.

    error\_bound[#](#tskit.PCAResult.error_bound "Link to this definition")
    :   An estimate of the error resulting from the randomized algorithm (experimental).
        Eigenvalues should be correct to within (roughly) this additive factor,
        and factors should be correct to within (roughly) this factor divided by the
        next-largest eigenvalue in the Euclidean norm. These estimates are obtained from
        a bound on the expected L2 operator norm between the true GRM and its
        low-dimensional approximation, from equation 1.11 in
        <https://arxiv.org/pdf/0909.4061> .

[previous

Data export](export.html "previous page")
[next

Numba Integration](numba.html "next page")

Contents

- [Trees and tree sequences](#trees-and-tree-sequences)
  - [`TreeSequence` API](#treesequence-api)
    - [General properties](#general-properties)
    - [Efficient table column access](#efficient-table-column-access)
    - [Loading and saving](#loading-and-saving)
    - [Obtaining trees](#obtaining-trees)
    - [Obtaining other objects](#obtaining-other-objects)
      - [Tree topology](#tree-topology)
      - [Genetic variation](#genetic-variation)
      - [Demography](#demography)
      - [Other](#other)
    - [Tree sequence modification](#tree-sequence-modification)
    - [Identity by descent](#sec-python-api-tree-sequences-ibd)
    - [Tables](#tables)
    - [Statistics](#statistics)
    - [Topological analysis](#topological-analysis)
    - [Display](#display)
    - [Export](#export)
  - [`Tree` API](#tree-api)
    - [General properties](#sec-python-api-trees-general-properties)
    - [Creating new trees](#creating-new-trees)
    - [Node measures](#node-measures)
      - [Simple measures](#simple-measures)
      - [Array access](#array-access)
    - [Tree traversal](#tree-traversal)
    - [Topological analysis](#sec-python-api-trees-topological-analysis)
    - [Comparing trees](#comparing-trees)
    - [Balance/imbalance indices](#balance-imbalance-indices)
    - [Sites and mutations](#sites-and-mutations)
    - [Moving to other trees](#moving-to-other-trees)
    - [Display](#id3)
    - [Export](#id4)
- [Tables and Table Collections](#tables-and-table-collections)
  - [`TableCollection` API](#tablecollection-api)
    - [General properties](#id5)
    - [Transformation](#transformation)
      - [Modification](#modification)
      - [Creating a valid tree sequence](#creating-a-valid-tree-sequence)
    - [Miscellaneous methods](#miscellaneous-methods)
    - [Export](#id6)
  - [Table APIs](#table-apis)
    - [Accessing table data](#accessing-table-data)
      - [Text columns](#text-columns)
      - [Binary columns](#binary-columns)
    - [Table functions](#table-functions)
- [Metadata API](#metadata-api)
- [Provenance](#provenance)
- [Utility functions](#utility-functions)
- [Reference documentation](#reference-documentation)
  - [Constants](#constants)
    - [`NULL`](#tskit.NULL)
    - [`MISSING_DATA`](#tskit.MISSING_DATA)
    - [`NODE_IS_SAMPLE`](#tskit.NODE_IS_SAMPLE)
    - [`FORWARD`](#tskit.FORWARD)
    - [`REVERSE`](#tskit.REVERSE)
    - [`ALLELES_01`](#tskit.ALLELES_01)
    - [`ALLELES_ACGT`](#tskit.ALLELES_ACGT)
    - [`UNKNOWN_TIME`](#tskit.UNKNOWN_TIME)
    - [`TIME_UNITS_UNKNOWN`](#tskit.TIME_UNITS_UNKNOWN)
    - [`TIME_UNITS_UNCALIBRATED`](#tskit.TIME_UNITS_UNCALIBRATED)
  - [Exceptions](#exceptions)
    - [`DuplicatePositionsError`](#tskit.DuplicatePositionsError)
    - [`MetadataEncodingError`](#tskit.MetadataEncodingError)
    - [`MetadataSchemaValidationError`](#tskit.MetadataSchemaValidationError)
    - [`MetadataValidationError`](#tskit.MetadataValidationError)
    - [`ProvenanceValidationError`](#tskit.ProvenanceValidationError)
  - [Top-level functions](#top-level-functions)
    - [`all_trees()`](#tskit.all_trees)
    - [`all_tree_shapes()`](#tskit.all_tree_shapes)
    - [`all_tree_labellings()`](#tskit.all_tree_labellings)
    - [`is_unknown_time()`](#tskit.is_unknown_time)
    - [`load()`](#tskit.load)
    - [`load_text()`](#tskit.load_text)
    - [`pack_bytes()`](#tskit.pack_bytes)
    - [`pack_strings()`](#tskit.pack_strings)
    - [`parse_edges()`](#tskit.parse_edges)
    - [`parse_individuals()`](#tskit.parse_individuals)
    - [`parse_mutations()`](#tskit.parse_mutations)
    - [`parse_nodes()`](#tskit.parse_nodes)
    - [`parse_populations()`](#tskit.parse_populations)
    - [`parse_migrations()`](#tskit.parse_migrations)
    - [`parse_sites()`](#tskit.parse_sites)
    - [`random_nucleotides()`](#tskit.random_nucleotides)
    - [`register_metadata_codec()`](#tskit.register_metadata_codec)
    - [`validate_provenance()`](#tskit.validate_provenance)
    - [`unpack_bytes()`](#tskit.unpack_bytes)
    - [`unpack_strings()`](#tskit.unpack_strings)
  - [Tree and tree sequence classes](#tree-and-tree-sequence-classes)
    - [The `Tree` class](#the-tree-class)
      - [`Tree`](#tskit.Tree)
        - [`Tree.copy()`](#tskit.Tree.copy)
        - [`Tree.tree_sequence`](#tskit.Tree.tree_sequence)
        - [`Tree.root_threshold`](#tskit.Tree.root_threshold)
        - [`Tree.first()`](#tskit.Tree.first)
        - [`Tree.last()`](#tskit.Tree.last)
        - [`Tree.next()`](#tskit.Tree.next)
        - [`Tree.prev()`](#tskit.Tree.prev)
        - [`Tree.clear()`](#tskit.Tree.clear)
        - [`Tree.seek_index()`](#tskit.Tree.seek_index)
        - [`Tree.seek()`](#tskit.Tree.seek)
        - [`Tree.rank()`](#tskit.Tree.rank)
        - [`Tree.unrank()`](#tskit.Tree.unrank)
        - [`Tree.count_topologies()`](#tskit.Tree.count_topologies)
        - [`Tree.branch_length()`](#tskit.Tree.branch_length)
        - [`Tree.total_branch_length`](#tskit.Tree.total_branch_length)
        - [`Tree.mrca()`](#tskit.Tree.mrca)
        - [`Tree.tmrca()`](#tskit.Tree.tmrca)
        - [`Tree.parent()`](#tskit.Tree.parent)
        - [`Tree.parent_array`](#tskit.Tree.parent_array)
        - [`Tree.ancestors()`](#tskit.Tree.ancestors)
        - [`Tree.left_child()`](#tskit.Tree.left_child)
        - [`Tree.left_child_array`](#tskit.Tree.left_child_array)
        - [`Tree.right_child()`](#tskit.Tree.right_child)
        - [`Tree.right_child_array`](#tskit.Tree.right_child_array)
        - [`Tree.left_sib()`](#tskit.Tree.left_sib)
        - [`Tree.left_sib_array`](#tskit.Tree.left_sib_array)
        - [`Tree.right_sib()`](#tskit.Tree.right_sib)
        - [`Tree.right_sib_array`](#tskit.Tree.right_sib_array)
        - [`Tree.siblings()`](#tskit.Tree.siblings)
        - [`Tree.num_children_array`](#tskit.Tree.num_children_array)
        - [`Tree.edge()`](#tskit.Tree.edge)
        - [`Tree.edge_array`](#tskit.Tree.edge_array)
        - [`Tree.virtual_root`](#tskit.Tree.virtual_root)
        - [`Tree.num_edges`](#tskit.Tree.num_edges)
        - [`Tree.left_root`](#tskit.Tree.left_root)
        - [`Tree.children()`](#tskit.Tree.children)
        - [`Tree.time()`](#tskit.Tree.time)
        - [`Tree.depth()`](#tskit.Tree.depth)
        - [`Tree.population()`](#tskit.Tree.population)
        - [`Tree.is_internal()`](#tskit.Tree.is_internal)
        - [`Tree.is_leaf()`](#tskit.Tree.is_leaf)
        - [`Tree.is_isolated()`](#tskit.Tree.is_isolated)
        - [`Tree.is_sample()`](#tskit.Tree.is_sample)
        - [`Tree.is_descendant()`](#tskit.Tree.is_descendant)
        - [`Tree.num_nodes`](#tskit.Tree.num_nodes)
        - [`Tree.num_roots`](#tskit.Tree.num_roots)
        - [`Tree.has_single_root`](#tskit.Tree.has_single_root)
        - [`Tree.has_multiple_roots`](#tskit.Tree.has_multiple_roots)
        - [`Tree.roots`](#tskit.Tree.roots)
        - [`Tree.root`](#tskit.Tree.root)
        - [`Tree.is_root()`](#tskit.Tree.is_root)
        - [`Tree.index`](#tskit.Tree.index)
        - [`Tree.interval`](#tskit.Tree.interval)
        - [`Tree.span`](#tskit.Tree.span)
        - [`Tree.mid`](#tskit.Tree.mid)
        - [`Tree.draw_text()`](#tskit.Tree.draw_text)
        - [`Tree.draw_svg()`](#tskit.Tree.draw_svg)
        - [`Tree.draw()`](#tskit.Tree.draw)
        - [`Tree.num_mutations`](#tskit.Tree.num_mutations)
        - [`Tree.num_sites`](#tskit.Tree.num_sites)
        - [`Tree.sites()`](#tskit.Tree.sites)
        - [`Tree.mutations()`](#tskit.Tree.mutations)
        - [`Tree.leaves()`](#tskit.Tree.leaves)
        - [`Tree.samples()`](#tskit.Tree.samples)
        - [`Tree.num_children()`](#tskit.Tree.num_children)
        - [`Tree.num_samples()`](#tskit.Tree.num_samples)
        - [`Tree.num_tracked_samples()`](#tskit.Tree.num_tracked_samples)
        - [`Tree.preorder()`](#tskit.Tree.preorder)
        - [`Tree.postorder()`](#tskit.Tree.postorder)
        - [`Tree.timeasc()`](#tskit.Tree.timeasc)
        - [`Tree.timedesc()`](#tskit.Tree.timedesc)
        - [`Tree.nodes()`](#tskit.Tree.nodes)
        - [`Tree.as_newick()`](#tskit.Tree.as_newick)
        - [`Tree.newick()`](#tskit.Tree.newick)
        - [`Tree.as_dict_of_dicts()`](#tskit.Tree.as_dict_of_dicts)
        - [`Tree.__str__()`](#tskit.Tree.__str__)
        - [`Tree._repr_html_()`](#tskit.Tree._repr_html_)
        - [`Tree.map_mutations()`](#tskit.Tree.map_mutations)
        - [`Tree.kc_distance()`](#tskit.Tree.kc_distance)
        - [`Tree.rf_distance()`](#tskit.Tree.rf_distance)
        - [`Tree.path_length()`](#tskit.Tree.path_length)
        - [`Tree.distance_between()`](#tskit.Tree.distance_between)
        - [`Tree.b1_index()`](#tskit.Tree.b1_index)
        - [`Tree.b2_index()`](#tskit.Tree.b2_index)
        - [`Tree.colless_index()`](#tskit.Tree.colless_index)
        - [`Tree.sackin_index()`](#tskit.Tree.sackin_index)
        - [`Tree.num_lineages()`](#tskit.Tree.num_lineages)
        - [`Tree.split_polytomies()`](#tskit.Tree.split_polytomies)
        - [`Tree.generate_star()`](#tskit.Tree.generate_star)
        - [`Tree.generate_balanced()`](#tskit.Tree.generate_balanced)
        - [`Tree.generate_comb()`](#tskit.Tree.generate_comb)
        - [`Tree.generate_random_binary()`](#tskit.Tree.generate_random_binary)
    - [The `TreeSequence` class](#the-treesequence-class)
      - [`TreeSequence`](#tskit.TreeSequence)
        - [`TreeSequence.equals()`](#tskit.TreeSequence.equals)
        - [`TreeSequence.aslist()`](#tskit.TreeSequence.aslist)
        - [`TreeSequence.dump()`](#tskit.TreeSequence.dump)
        - [`TreeSequence.reference_sequence`](#tskit.TreeSequence.reference_sequence)
        - [`TreeSequence.has_reference_sequence()`](#tskit.TreeSequence.has_reference_sequence)
        - [`TreeSequence.tables_dict`](#tskit.TreeSequence.tables_dict)
        - [`TreeSequence.tables`](#tskit.TreeSequence.tables)
        - [`TreeSequence.nbytes`](#tskit.TreeSequence.nbytes)
        - [`TreeSequence.dump_tables()`](#tskit.TreeSequence.dump_tables)
        - [`TreeSequence.link_ancestors()`](#tskit.TreeSequence.link_ancestors)
        - [`TreeSequence.dump_text()`](#tskit.TreeSequence.dump_text)
        - [`TreeSequence.__str__()`](#tskit.TreeSequence.__str__)
        - [`TreeSequence._repr_html_()`](#tskit.TreeSequence._repr_html_)
        - [`TreeSequence.num_samples`](#tskit.TreeSequence.num_samples)
        - [`TreeSequence.table_metadata_schemas`](#tskit.TreeSequence.table_metadata_schemas)
        - [`TreeSequence.discrete_genome`](#tskit.TreeSequence.discrete_genome)
        - [`TreeSequence.discrete_time`](#tskit.TreeSequence.discrete_time)
        - [`TreeSequence.min_time`](#tskit.TreeSequence.min_time)
        - [`TreeSequence.max_time`](#tskit.TreeSequence.max_time)
        - [`TreeSequence.sequence_length`](#tskit.TreeSequence.sequence_length)
        - [`TreeSequence.metadata`](#tskit.TreeSequence.metadata)
        - [`TreeSequence.metadata_schema`](#tskit.TreeSequence.metadata_schema)
        - [`TreeSequence.time_units`](#tskit.TreeSequence.time_units)
        - [`TreeSequence.num_edges`](#tskit.TreeSequence.num_edges)
        - [`TreeSequence.num_trees`](#tskit.TreeSequence.num_trees)
        - [`TreeSequence.num_sites`](#tskit.TreeSequence.num_sites)
        - [`TreeSequence.num_mutations`](#tskit.TreeSequence.num_mutations)
        - [`TreeSequence.num_individuals`](#tskit.TreeSequence.num_individuals)
        - [`TreeSequence.num_nodes`](#tskit.TreeSequence.num_nodes)
        - [`TreeSequence.num_provenances`](#tskit.TreeSequence.num_provenances)
        - [`TreeSequence.num_populations`](#tskit.TreeSequence.num_populations)
        - [`TreeSequence.num_migrations`](#tskit.TreeSequence.num_migrations)
        - [`TreeSequence.max_root_time`](#tskit.TreeSequence.max_root_time)
        - [`TreeSequence.migrations()`](#tskit.TreeSequence.migrations)
        - [`TreeSequence.individuals()`](#tskit.TreeSequence.individuals)
        - [`TreeSequence.nodes()`](#tskit.TreeSequence.nodes)
        - [`TreeSequence.edges()`](#tskit.TreeSequence.edges)
        - [`TreeSequence.edge_diffs()`](#tskit.TreeSequence.edge_diffs)
        - [`TreeSequence.sites()`](#tskit.TreeSequence.sites)
        - [`TreeSequence.mutations()`](#tskit.TreeSequence.mutations)
        - [`TreeSequence.populations()`](#tskit.TreeSequence.populations)
        - [`TreeSequence.provenances()`](#tskit.TreeSequence.provenances)
        - [`TreeSequence.breakpoints()`](#tskit.TreeSequence.breakpoints)
        - [`TreeSequence.at()`](#tskit.TreeSequence.at)
        - [`TreeSequence.at_index()`](#tskit.TreeSequence.at_index)
        - [`TreeSequence.first()`](#tskit.TreeSequence.first)
        - [`TreeSequence.last()`](#tskit.TreeSequence.last)
        - [`TreeSequence.trees()`](#tskit.TreeSequence.trees)
        - [`TreeSequence.coiterate()`](#tskit.TreeSequence.coiterate)
        - [`TreeSequence.haplotypes()`](#tskit.TreeSequence.haplotypes)
        - [`TreeSequence.variants()`](#tskit.TreeSequence.variants)
        - [`TreeSequence.genotype_matrix()`](#tskit.TreeSequence.genotype_matrix)
        - [`TreeSequence.alignments()`](#tskit.TreeSequence.alignments)
        - [`TreeSequence.individuals_population`](#tskit.TreeSequence.individuals_population)
        - [`TreeSequence.individuals_time`](#tskit.TreeSequence.individuals_time)
        - [`TreeSequence.individuals_location`](#tskit.TreeSequence.individuals_location)
        - [`TreeSequence.individuals_flags`](#tskit.TreeSequence.individuals_flags)
        - [`TreeSequence.individuals_metadata`](#tskit.TreeSequence.individuals_metadata)
        - [`TreeSequence.individuals_nodes`](#tskit.TreeSequence.individuals_nodes)
        - [`TreeSequence.nodes_metadata`](#tskit.TreeSequence.nodes_metadata)
        - [`TreeSequence.nodes_time`](#tskit.TreeSequence.nodes_time)
        - [`TreeSequence.nodes_flags`](#tskit.TreeSequence.nodes_flags)
        - [`TreeSequence.nodes_population`](#tskit.TreeSequence.nodes_population)
        - [`TreeSequence.nodes_individual`](#tskit.TreeSequence.nodes_individual)
        - [`TreeSequence.edges_left`](#tskit.TreeSequence.edges_left)
        - [`TreeSequence.edges_right`](#tskit.TreeSequence.edges_right)
        - [`TreeSequence.edges_parent`](#tskit.TreeSequence.edges_parent)
        - [`TreeSequence.edges_child`](#tskit.TreeSequence.edges_child)
        - [`TreeSequence.edges_metadata`](#tskit.TreeSequence.edges_metadata)
        - [`TreeSequence.sites_position`](#tskit.TreeSequence.sites_position)
        - [`TreeSequence.sites_ancestral_state`](#tskit.TreeSequence.sites_ancestral_state)
        - [`TreeSequence.sites_metadata`](#tskit.TreeSequence.sites_metadata)
        - [`TreeSequence.mutations_site`](#tskit.TreeSequence.mutations_site)
        - [`TreeSequence.mutations_node`](#tskit.TreeSequence.mutations_node)
        - [`TreeSequence.mutations_parent`](#tskit.TreeSequence.mutations_parent)
        - [`TreeSequence.mutations_time`](#tskit.TreeSequence.mutations_time)
        - [`TreeSequence.mutations_derived_state`](#tskit.TreeSequence.mutations_derived_state)
        - [`TreeSequence.mutations_metadata`](#tskit.TreeSequence.mutations_metadata)
        - [`TreeSequence.mutations_edge`](#tskit.TreeSequence.mutations_edge)
        - [`TreeSequence.mutations_inherited_state`](#tskit.TreeSequence.mutations_inherited_state)
        - [`TreeSequence.migrations_left`](#tskit.TreeSequence.migrations_left)
        - [`TreeSequence.migrations_right`](#tskit.TreeSequence.migrations_right)
        - [`TreeSequence.migrations_node`](#tskit.TreeSequence.migrations_node)
        - [`TreeSequence.migrations_source`](#tskit.TreeSequence.migrations_source)
        - [`TreeSequence.migrations_dest`](#tskit.TreeSequence.migrations_dest)
        - [`TreeSequence.migrations_time`](#tskit.TreeSequence.migrations_time)
        - [`TreeSequence.migrations_metadata`](#tskit.TreeSequence.migrations_metadata)
        - [`TreeSequence.populations_metadata`](#tskit.TreeSequence.populations_metadata)
        - [`TreeSequence.indexes_edge_insertion_order`](#tskit.TreeSequence.indexes_edge_insertion_order)
        - [`TreeSequence.indexes_edge_removal_order`](#tskit.TreeSequence.indexes_edge_removal_order)
        - [`TreeSequence.individual()`](#tskit.TreeSequence.individual)
        - [`TreeSequence.node()`](#tskit.TreeSequence.node)
        - [`TreeSequence.edge()`](#tskit.TreeSequence.edge)
        - [`TreeSequence.migration()`](#tskit.TreeSequence.migration)
        - [`TreeSequence.mutation()`](#tskit.TreeSequence.mutation)
        - [`TreeSequence.site()`](#tskit.TreeSequence.site)
        - [`TreeSequence.population()`](#tskit.TreeSequence.population)
        - [`TreeSequence.provenance()`](#tskit.TreeSequence.provenance)
        - [`TreeSequence.samples()`](#tskit.TreeSequence.samples)
        - [`TreeSequence.as_vcf()`](#tskit.TreeSequence.as_vcf)
        - [`TreeSequence.write_vcf()`](#tskit.TreeSequence.write_vcf)
        - [`TreeSequence.write_fasta()`](#tskit.TreeSequence.write_fasta)
        - [`TreeSequence.as_fasta()`](#tskit.TreeSequence.as_fasta)
        - [`TreeSequence.write_nexus()`](#tskit.TreeSequence.write_nexus)
        - [`TreeSequence.as_nexus()`](#tskit.TreeSequence.as_nexus)
        - [`TreeSequence.to_macs()`](#tskit.TreeSequence.to_macs)
        - [`TreeSequence.simplify()`](#tskit.TreeSequence.simplify)
        - [`TreeSequence.delete_sites()`](#tskit.TreeSequence.delete_sites)
        - [`TreeSequence.delete_intervals()`](#tskit.TreeSequence.delete_intervals)
        - [`TreeSequence.keep_intervals()`](#tskit.TreeSequence.keep_intervals)
        - [`TreeSequence.ltrim()`](#tskit.TreeSequence.ltrim)
        - [`TreeSequence.rtrim()`](#tskit.TreeSequence.rtrim)
        - [`TreeSequence.trim()`](#tskit.TreeSequence.trim)
        - [`TreeSequence.shift()`](#tskit.TreeSequence.shift)
        - [`TreeSequence.concatenate()`](#tskit.TreeSequence.concatenate)
        - [`TreeSequence.split_edges()`](#tskit.TreeSequence.split_edges)
        - [`TreeSequence.decapitate()`](#tskit.TreeSequence.decapitate)
        - [`TreeSequence.extend_haplotypes()`](#tskit.TreeSequence.extend_haplotypes)
        - [`TreeSequence.subset()`](#tskit.TreeSequence.subset)
        - [`TreeSequence.union()`](#tskit.TreeSequence.union)
        - [`TreeSequence.draw_svg()`](#tskit.TreeSequence.draw_svg)
        - [`TreeSequence.draw_text()`](#tskit.TreeSequence.draw_text)
        - [`TreeSequence.general_stat()`](#tskit.TreeSequence.general_stat)
        - [`TreeSequence.sample_count_stat()`](#tskit.TreeSequence.sample_count_stat)
        - [`TreeSequence.diversity()`](#tskit.TreeSequence.diversity)
        - [`TreeSequence.divergence()`](#tskit.TreeSequence.divergence)
        - [`TreeSequence.divergence_matrix()`](#tskit.TreeSequence.divergence_matrix)
        - [`TreeSequence.genetic_relatedness()`](#tskit.TreeSequence.genetic_relatedness)
        - [`TreeSequence.genetic_relatedness_matrix()`](#tskit.TreeSequence.genetic_relatedness_matrix)
        - [`TreeSequence.genetic_relatedness_weighted()`](#tskit.TreeSequence.genetic_relatedness_weighted)
        - [`TreeSequence.genetic_relatedness_vector()`](#tskit.TreeSequence.genetic_relatedness_vector)
        - [`TreeSequence.pca()`](#tskit.TreeSequence.pca)
        - [`TreeSequence.trait_covariance()`](#tskit.TreeSequence.trait_covariance)
        - [`TreeSequence.trait_correlation()`](#tskit.TreeSequence.trait_correlation)
        - [`TreeSequence.trait_regression()`](#tskit.TreeSequence.trait_regression)
        - [`TreeSequence.trait_linear_model()`](#tskit.TreeSequence.trait_linear_model)
        - [`TreeSequence.segregating_sites()`](#tskit.TreeSequence.segregating_sites)
        - [`TreeSequence.allele_frequency_spectrum()`](#tskit.TreeSequence.allele_frequency_spectrum)
        - [`TreeSequence.Tajimas_D()`](#tskit.TreeSequence.Tajimas_D)
        - [`TreeSequence.Fst()`](#tskit.TreeSequence.Fst)
        - [`TreeSequence.Y3()`](#tskit.TreeSequence.Y3)
        - [`TreeSequence.Y2()`](#tskit.TreeSequence.Y2)
        - [`TreeSequence.Y1()`](#tskit.TreeSequence.Y1)
        - [`TreeSequence.f4()`](#tskit.TreeSequence.f4)
        - [`TreeSequence.f3()`](#tskit.TreeSequence.f3)
        - [`TreeSequence.f2()`](#tskit.TreeSequence.f2)
        - [`TreeSequence.mean_descendants()`](#tskit.TreeSequence.mean_descendants)
        - [`TreeSequence.genealogical_nearest_neighbours()`](#tskit.TreeSequence.genealogical_nearest_neighbours)
        - [`TreeSequence.kc_distance()`](#tskit.TreeSequence.kc_distance)
        - [`TreeSequence.count_topologies()`](#tskit.TreeSequence.count_topologies)
        - [`TreeSequence.ibd_segments()`](#tskit.TreeSequence.ibd_segments)
        - [`TreeSequence.pair_coalescence_counts()`](#tskit.TreeSequence.pair_coalescence_counts)
        - [`TreeSequence.pair_coalescence_quantiles()`](#tskit.TreeSequence.pair_coalescence_quantiles)
        - [`TreeSequence.pair_coalescence_rates()`](#tskit.TreeSequence.pair_coalescence_rates)
        - [`TreeSequence.impute_unknown_mutations_time()`](#tskit.TreeSequence.impute_unknown_mutations_time)
        - [`TreeSequence.sample_nodes_by_ploidy()`](#tskit.TreeSequence.sample_nodes_by_ploidy)
        - [`TreeSequence.map_to_vcf_model()`](#tskit.TreeSequence.map_to_vcf_model)
        - [`TreeSequence.pairwise_diversity()`](#tskit.TreeSequence.pairwise_diversity)
  - [Simple container classes](#simple-container-classes)
    - [The `Individual` class](#the-individual-class)
      - [`Individual`](#tskit.Individual)
        - [`Individual.id`](#tskit.Individual.id)
        - [`Individual.flags`](#tskit.Individual.flags)
        - [`Individual.location`](#tskit.Individual.location)
        - [`Individual.parents`](#tskit.Individual.parents)
        - [`Individual.nodes`](#tskit.Individual.nodes)
        - [`Individual.metadata`](#tskit.Individual.metadata)
    - [The `Node` class](#the-node-class)
      - [`Node`](#tskit.Node)
        - [`Node.id`](#tskit.Node.id)
        - [`Node.flags`](#tskit.Node.flags)
        - [`Node.time`](#tskit.Node.time)
        - [`Node.population`](#tskit.Node.population)
        - [`Node.individual`](#tskit.Node.individual)
        - [`Node.metadata`](#tskit.Node.metadata)
        - [`Node.is_sample()`](#tskit.Node.is_sample)
    - [The `Edge` class](#the-edge-class)
      - [`Edge`](#tskit.Edge)
        - [`Edge.id`](#tskit.Edge.id)
        - [`Edge.left`](#tskit.Edge.left)
        - [`Edge.right`](#tskit.Edge.right)
        - [`Edge.parent`](#tskit.Edge.parent)
        - [`Edge.child`](#tskit.Edge.child)
        - [`Edge.metadata`](#tskit.Edge.metadata)
        - [`Edge.span`](#tskit.Edge.span)
        - [`Edge.interval`](#tskit.Edge.interval)
    - [The `Site` class](#the-site-class)
      - [`Site`](#tskit.Site)
        - [`Site.id`](#tskit.Site.id)
        - [`Site.position`](#tskit.Site.position)
        - [`Site.ancestral_state`](#tskit.Site.ancestral_state)
        - [`Site.mutations`](#tskit.Site.mutations)
        - [`Site.metadata`](#tskit.Site.metadata)
        - [`Site.alleles`](#tskit.Site.alleles)
    - [The `Mutation` class](#the-mutation-class)
      - [`Mutation`](#tskit.Mutation)
        - [`Mutation.id`](#tskit.Mutation.id)
        - [`Mutation.site`](#tskit.Mutation.site)
        - [`Mutation.node`](#tskit.Mutation.node)
        - [`Mutation.time`](#tskit.Mutation.time)
        - [`Mutation.derived_state`](#tskit.Mutation.derived_state)
        - [`Mutation.parent`](#tskit.Mutation.parent)
        - [`Mutation.metadata`](#tskit.Mutation.metadata)
        - [`Mutation.edge`](#tskit.Mutation.edge)
        - [`Mutation.inherited_state`](#tskit.Mutation.inherited_state)
    - [The `Variant` class](#the-variant-class)
      - [`Variant`](#tskit.Variant)
        - [`Variant.site`](#tskit.Variant.site)
        - [`Variant.alleles`](#tskit.Variant.alleles)
        - [`Variant.samples`](#tskit.Variant.samples)
        - [`Variant.genotypes`](#tskit.Variant.genotypes)
        - [`Variant.isolated_as_missing`](#tskit.Variant.isolated_as_missing)
        - [`Variant.has_missing_data`](#tskit.Variant.has_missing_data)
        - [`Variant.num_missing`](#tskit.Variant.num_missing)
        - [`Variant.num_alleles`](#tskit.Variant.num_alleles)
        - [`Variant.decode()`](#tskit.Variant.decode)
        - [`Variant.copy()`](#tskit.Variant.copy)
        - [`Variant.states()`](#tskit.Variant.states)
        - [`Variant.counts()`](#tskit.Variant.counts)
        - [`Variant.frequencies()`](#tskit.Variant.frequencies)
    - [The `Migration` class](#the-migration-class)
      - [`Migration`](#tskit.Migration)
        - [`Migration.left`](#tskit.Migration.left)
        - [`Migration.right`](#tskit.Migration.right)
        - [`Migration.node`](#tskit.Migration.node)
        - [`Migration.source`](#tskit.Migration.source)
        - [`Migration.dest`](#tskit.Migration.dest)
        - [`Migration.time`](#tskit.Migration.time)
        - [`Migration.metadata`](#tskit.Migration.metadata)
        - [`Migration.id`](#tskit.Migration.id)
    - [The `Population` class](#the-population-class)
      - [`Population`](#tskit.Population)
        - [`Population.id`](#tskit.Population.id)
        - [`Population.metadata`](#tskit.Population.metadata)
    - [The `Provenance` class](#the-provenance-class)
      - [`Provenance`](#tskit.Provenance)
        - [`Provenance.timestamp`](#tskit.Provenance.timestamp)
        - [`Provenance.record`](#tskit.Provenance.record)
    - [The `Interval` class](#the-interval-class)
      - [`Interval`](#tskit.Interval)
        - [`Interval.left`](#tskit.Interval.left)
        - [`Interval.right`](#tskit.Interval.right)
        - [`Interval.span`](#tskit.Interval.span)
        - [`Interval.mid`](#tskit.Interval.mid)
    - [The `Rank` class](#the-rank-class)
      - [`Rank`](#tskit.Rank)
        - [`Rank.shape`](#tskit.Rank.shape)
        - [`Rank.label`](#tskit.Rank.label)
  - [TableCollection and Table classes](#tablecollection-and-table-classes)
    - [The `TableCollection` class](#the-tablecollection-class)
      - [`TableCollection`](#tskit.TableCollection)
        - [`TableCollection.individuals`](#tskit.TableCollection.individuals)
        - [`TableCollection.nodes`](#tskit.TableCollection.nodes)
        - [`TableCollection.edges`](#tskit.TableCollection.edges)
        - [`TableCollection.migrations`](#tskit.TableCollection.migrations)
        - [`TableCollection.sites`](#tskit.TableCollection.sites)
        - [`TableCollection.mutations`](#tskit.TableCollection.mutations)
        - [`TableCollection.populations`](#tskit.TableCollection.populations)
        - [`TableCollection.provenances`](#tskit.TableCollection.provenances)
        - [`TableCollection.indexes`](#tskit.TableCollection.indexes)
        - [`TableCollection.sequence_length`](#tskit.TableCollection.sequence_length)
        - [`TableCollection.file_uuid`](#tskit.TableCollection.file_uuid)
        - [`TableCollection.time_units`](#tskit.TableCollection.time_units)
        - [`TableCollection.has_reference_sequence()`](#tskit.TableCollection.has_reference_sequence)
        - [`TableCollection.reference_sequence`](#tskit.TableCollection.reference_sequence)
        - [`TableCollection.asdict()`](#tskit.TableCollection.asdict)
        - [`TableCollection.table_name_map`](#tskit.TableCollection.table_name_map)
        - [`TableCollection.nbytes`](#tskit.TableCollection.nbytes)
        - [`TableCollection.equals()`](#tskit.TableCollection.equals)
        - [`TableCollection.assert_equals()`](#tskit.TableCollection.assert_equals)
        - [`TableCollection.dump()`](#tskit.TableCollection.dump)
        - [`TableCollection.copy()`](#tskit.TableCollection.copy)
        - [`TableCollection.tree_sequence()`](#tskit.TableCollection.tree_sequence)
        - [`TableCollection.simplify()`](#tskit.TableCollection.simplify)
        - [`TableCollection.link_ancestors()`](#tskit.TableCollection.link_ancestors)
        - [`TableCollection.sort()`](#tskit.TableCollection.sort)
        - [`TableCollection.sort_individuals()`](#tskit.TableCollection.sort_individuals)
        - [`TableCollection.canonicalise()`](#tskit.TableCollection.canonicalise)
        - [`TableCollection.compute_mutation_parents()`](#tskit.TableCollection.compute_mutation_parents)
        - [`TableCollection.compute_mutation_times()`](#tskit.TableCollection.compute_mutation_times)
        - [`TableCollection.deduplicate_sites()`](#tskit.TableCollection.deduplicate_sites)
        - [`TableCollection.delete_sites()`](#tskit.TableCollection.delete_sites)
        - [`TableCollection.delete_intervals()`](#tskit.TableCollection.delete_intervals)
        - [`TableCollection.keep_intervals()`](#tskit.TableCollection.keep_intervals)
        - [`TableCollection.ltrim()`](#tskit.TableCollection.ltrim)
        - [`TableCollection.rtrim()`](#tskit.TableCollection.rtrim)
        - [`TableCollection.trim()`](#tskit.TableCollection.trim)
        - [`TableCollection.shift()`](#tskit.TableCollection.shift)
        - [`TableCollection.delete_older()`](#tskit.TableCollection.delete_older)
        - [`TableCollection.clear()`](#tskit.TableCollection.clear)
        - [`TableCollection.has_index()`](#tskit.TableCollection.has_index)
        - [`TableCollection.build_index()`](#tskit.TableCollection.build_index)
        - [`TableCollection.drop_index()`](#tskit.TableCollection.drop_index)
        - [`TableCollection.subset()`](#tskit.TableCollection.subset)
        - [`TableCollection.union()`](#tskit.TableCollection.union)
        - [`TableCollection.ibd_segments()`](#tskit.TableCollection.ibd_segments)
        - [`TableCollection.metadata`](#tskit.TableCollection.metadata)
        - [`TableCollection.metadata_bytes`](#tskit.TableCollection.metadata_bytes)
        - [`TableCollection.metadata_schema`](#tskit.TableCollection.metadata_schema)
    - [`IndividualTable` classes](#individualtable-classes)
      - [`IndividualTable`](#tskit.IndividualTable)
        - [`IndividualTable.add_row()`](#tskit.IndividualTable.add_row)
        - [`IndividualTable.set_columns()`](#tskit.IndividualTable.set_columns)
        - [`IndividualTable.append_columns()`](#tskit.IndividualTable.append_columns)
        - [`IndividualTable.packset_location()`](#tskit.IndividualTable.packset_location)
        - [`IndividualTable.packset_parents()`](#tskit.IndividualTable.packset_parents)
        - [`IndividualTable.keep_rows()`](#tskit.IndividualTable.keep_rows)
        - [`IndividualTable.__getitem__()`](#tskit.IndividualTable.__getitem__)
        - [`IndividualTable.append()`](#tskit.IndividualTable.append)
        - [`IndividualTable.asdict()`](#tskit.IndividualTable.asdict)
        - [`IndividualTable.assert_equals()`](#tskit.IndividualTable.assert_equals)
        - [`IndividualTable.clear()`](#tskit.IndividualTable.clear)
        - [`IndividualTable.copy()`](#tskit.IndividualTable.copy)
        - [`IndividualTable.drop_metadata()`](#tskit.IndividualTable.drop_metadata)
        - [`IndividualTable.equals()`](#tskit.IndividualTable.equals)
        - [`IndividualTable.metadata_schema`](#tskit.IndividualTable.metadata_schema)
        - [`IndividualTable.metadata_vector()`](#tskit.IndividualTable.metadata_vector)
        - [`IndividualTable.nbytes`](#tskit.IndividualTable.nbytes)
        - [`IndividualTable.packset_metadata()`](#tskit.IndividualTable.packset_metadata)
        - [`IndividualTable.truncate()`](#tskit.IndividualTable.truncate)
      - [Associated row class](#associated-row-class)
        - [`IndividualTableRow`](#tskit.IndividualTableRow)
          - [`IndividualTableRow.flags`](#tskit.IndividualTableRow.flags)
          - [`IndividualTableRow.location`](#tskit.IndividualTableRow.location)
          - [`IndividualTableRow.parents`](#tskit.IndividualTableRow.parents)
          - [`IndividualTableRow.metadata`](#tskit.IndividualTableRow.metadata)
          - [`IndividualTableRow.asdict()`](#tskit.IndividualTableRow.asdict)
          - [`IndividualTableRow.replace()`](#tskit.IndividualTableRow.replace)
    - [`NodeTable` classes](#nodetable-classes)
      - [`NodeTable`](#tskit.NodeTable)
        - [`NodeTable.add_row()`](#tskit.NodeTable.add_row)
        - [`NodeTable.set_columns()`](#tskit.NodeTable.set_columns)
        - [`NodeTable.append_columns()`](#tskit.NodeTable.append_columns)
        - [`NodeTable.__getitem__()`](#tskit.NodeTable.__getitem__)
        - [`NodeTable.append()`](#tskit.NodeTable.append)
        - [`NodeTable.asdict()`](#tskit.NodeTable.asdict)
        - [`NodeTable.assert_equals()`](#tskit.NodeTable.assert_equals)
        - [`NodeTable.clear()`](#tskit.NodeTable.clear)
        - [`NodeTable.copy()`](#tskit.NodeTable.copy)
        - [`NodeTable.drop_metadata()`](#tskit.NodeTable.drop_metadata)
        - [`NodeTable.equals()`](#tskit.NodeTable.equals)
        - [`NodeTable.keep_rows()`](#tskit.NodeTable.keep_rows)
        - [`NodeTable.metadata_schema`](#tskit.NodeTable.metadata_schema)
        - [`NodeTable.metadata_vector()`](#tskit.NodeTable.metadata_vector)
        - [`NodeTable.nbytes`](#tskit.NodeTable.nbytes)
        - [`NodeTable.packset_metadata()`](#tskit.NodeTable.packset_metadata)
        - [`NodeTable.truncate()`](#tskit.NodeTable.truncate)
      - [Associated row class](#id10)
        - [`NodeTableRow`](#tskit.NodeTableRow)
          - [`NodeTableRow.flags`](#tskit.NodeTableRow.flags)
          - [`NodeTableRow.time`](#tskit.NodeTableRow.time)
          - [`NodeTableRow.population`](#tskit.NodeTableRow.population)
          - [`NodeTableRow.individual`](#tskit.NodeTableRow.individual)
          - [`NodeTableRow.metadata`](#tskit.NodeTableRow.metadata)
          - [`NodeTableRow.asdict()`](#tskit.NodeTableRow.asdict)
          - [`NodeTableRow.replace()`](#tskit.NodeTableRow.replace)
    - [`EdgeTable` classes](#edgetable-classes)
      - [`EdgeTable`](#tskit.EdgeTable)
        - [`EdgeTable.add_row()`](#tskit.EdgeTable.add_row)
        - [`EdgeTable.set_columns()`](#tskit.EdgeTable.set_columns)
        - [`EdgeTable.append_columns()`](#tskit.EdgeTable.append_columns)
        - [`EdgeTable.squash()`](#tskit.EdgeTable.squash)
        - [`EdgeTable.__getitem__()`](#tskit.EdgeTable.__getitem__)
        - [`EdgeTable.append()`](#tskit.EdgeTable.append)
        - [`EdgeTable.asdict()`](#tskit.EdgeTable.asdict)
        - [`EdgeTable.assert_equals()`](#tskit.EdgeTable.assert_equals)
        - [`EdgeTable.clear()`](#tskit.EdgeTable.clear)
        - [`EdgeTable.copy()`](#tskit.EdgeTable.copy)
        - [`EdgeTable.drop_metadata()`](#tskit.EdgeTable.drop_metadata)
        - [`EdgeTable.equals()`](#tskit.EdgeTable.equals)
        - [`EdgeTable.keep_rows()`](#tskit.EdgeTable.keep_rows)
        - [`EdgeTable.metadata_schema`](#tskit.EdgeTable.metadata_schema)
        - [`EdgeTable.metadata_vector()`](#tskit.EdgeTable.metadata_vector)
        - [`EdgeTable.nbytes`](#tskit.EdgeTable.nbytes)
        - [`EdgeTable.packset_metadata()`](#tskit.EdgeTable.packset_metadata)
        - [`EdgeTable.truncate()`](#tskit.EdgeTable.truncate)
      - [Associated row class](#id11)
        - [`EdgeTableRow`](#tskit.EdgeTableRow)
          - [`EdgeTableRow.left`](#tskit.EdgeTableRow.left)
          - [`EdgeTableRow.right`](#tskit.EdgeTableRow.right)
          - [`EdgeTableRow.parent`](#tskit.EdgeTableRow.parent)
          - [`EdgeTableRow.child`](#tskit.EdgeTableRow.child)
          - [`EdgeTableRow.metadata`](#tskit.EdgeTableRow.metadata)
          - [`EdgeTableRow.asdict()`](#tskit.EdgeTableRow.asdict)
          - [`EdgeTableRow.replace()`](#tskit.EdgeTableRow.replace)
    - [`MigrationTable` classes](#migrationtable-classes)
      - [`MigrationTable`](#tskit.MigrationTable)
        - [`MigrationTable.add_row()`](#tskit.MigrationTable.add_row)
        - [`MigrationTable.set_columns()`](#tskit.MigrationTable.set_columns)
        - [`MigrationTable.append_columns()`](#tskit.MigrationTable.append_columns)
        - [`MigrationTable.__getitem__()`](#tskit.MigrationTable.__getitem__)
        - [`MigrationTable.append()`](#tskit.MigrationTable.append)
        - [`MigrationTable.asdict()`](#tskit.MigrationTable.asdict)
        - [`MigrationTable.assert_equals()`](#tskit.MigrationTable.assert_equals)
        - [`MigrationTable.clear()`](#tskit.MigrationTable.clear)
        - [`MigrationTable.copy()`](#tskit.MigrationTable.copy)
        - [`MigrationTable.drop_metadata()`](#tskit.MigrationTable.drop_metadata)
        - [`MigrationTable.equals()`](#tskit.MigrationTable.equals)
        - [`MigrationTable.keep_rows()`](#tskit.MigrationTable.keep_rows)
        - [`MigrationTable.metadata_schema`](#tskit.MigrationTable.metadata_schema)
        - [`MigrationTable.metadata_vector()`](#tskit.MigrationTable.metadata_vector)
        - [`MigrationTable.nbytes`](#tskit.MigrationTable.nbytes)
        - [`MigrationTable.packset_metadata()`](#tskit.MigrationTable.packset_metadata)
        - [`MigrationTable.truncate()`](#tskit.MigrationTable.truncate)
      - [Associated row class](#id12)
        - [`MigrationTableRow`](#tskit.MigrationTableRow)
          - [`MigrationTableRow.left`](#tskit.MigrationTableRow.left)
          - [`MigrationTableRow.right`](#tskit.MigrationTableRow.right)
          - [`MigrationTableRow.node`](#tskit.MigrationTableRow.node)
          - [`MigrationTableRow.source`](#tskit.MigrationTableRow.source)
          - [`MigrationTableRow.dest`](#tskit.MigrationTableRow.dest)
          - [`MigrationTableRow.time`](#tskit.MigrationTableRow.time)
          - [`MigrationTableRow.metadata`](#tskit.MigrationTableRow.metadata)
          - [`MigrationTableRow.asdict()`](#tskit.MigrationTableRow.asdict)
          - [`MigrationTableRow.replace()`](#tskit.MigrationTableRow.replace)
    - [`SiteTable` classes](#sitetable-classes)
      - [`SiteTable`](#tskit.SiteTable)
        - [`SiteTable.add_row()`](#tskit.SiteTable.add_row)
        - [`SiteTable.set_columns()`](#tskit.SiteTable.set_columns)
        - [`SiteTable.append_columns()`](#tskit.SiteTable.append_columns)
        - [`SiteTable.packset_ancestral_state()`](#tskit.SiteTable.packset_ancestral_state)
        - [`SiteTable.__getitem__()`](#tskit.SiteTable.__getitem__)
        - [`SiteTable.append()`](#tskit.SiteTable.append)
        - [`SiteTable.asdict()`](#tskit.SiteTable.asdict)
        - [`SiteTable.assert_equals()`](#tskit.SiteTable.assert_equals)
        - [`SiteTable.clear()`](#tskit.SiteTable.clear)
        - [`SiteTable.copy()`](#tskit.SiteTable.copy)
        - [`SiteTable.drop_metadata()`](#tskit.SiteTable.drop_metadata)
        - [`SiteTable.equals()`](#tskit.SiteTable.equals)
        - [`SiteTable.keep_rows()`](#tskit.SiteTable.keep_rows)
        - [`SiteTable.metadata_schema`](#tskit.SiteTable.metadata_schema)
        - [`SiteTable.metadata_vector()`](#tskit.SiteTable.metadata_vector)
        - [`SiteTable.nbytes`](#tskit.SiteTable.nbytes)
        - [`SiteTable.packset_metadata()`](#tskit.SiteTable.packset_metadata)
        - [`SiteTable.truncate()`](#tskit.SiteTable.truncate)
      - [Associated row class](#id13)
        - [`SiteTableRow`](#tskit.SiteTableRow)
          - [`SiteTableRow.position`](#tskit.SiteTableRow.position)
          - [`SiteTableRow.ancestral_state`](#tskit.SiteTableRow.ancestral_state)
          - [`SiteTableRow.metadata`](#tskit.SiteTableRow.metadata)
          - [`SiteTableRow.asdict()`](#tskit.SiteTableRow.asdict)
          - [`SiteTableRow.replace()`](#tskit.SiteTableRow.replace)
    - [`MutationTable` classes](#mutationtable-classes)
      - [`MutationTable`](#tskit.MutationTable)
        - [`MutationTable.add_row()`](#tskit.MutationTable.add_row)
        - [`MutationTable.set_columns()`](#tskit.MutationTable.set_columns)
        - [`MutationTable.append_columns()`](#tskit.MutationTable.append_columns)
        - [`MutationTable.packset_derived_state()`](#tskit.MutationTable.packset_derived_state)
        - [`MutationTable.keep_rows()`](#tskit.MutationTable.keep_rows)
        - [`MutationTable.__getitem__()`](#tskit.MutationTable.__getitem__)
        - [`MutationTable.append()`](#tskit.MutationTable.append)
        - [`MutationTable.asdict()`](#tskit.MutationTable.asdict)
        - [`MutationTable.assert_equals()`](#tskit.MutationTable.assert_equals)
        - [`MutationTable.clear()`](#tskit.MutationTable.clear)
        - [`MutationTable.copy()`](#tskit.MutationTable.copy)
        - [`MutationTable.drop_metadata()`](#tskit.MutationTable.drop_metadata)
        - [`MutationTable.equals()`](#tskit.MutationTable.equals)
        - [`MutationTable.metadata_schema`](#tskit.MutationTable.metadata_schema)
        - [`MutationTable.metadata_vector()`](#tskit.MutationTable.metadata_vector)
        - [`MutationTable.nbytes`](#tskit.MutationTable.nbytes)
        - [`MutationTable.packset_metadata()`](#tskit.MutationTable.packset_metadata)
        - [`MutationTable.truncate()`](#tskit.MutationTable.truncate)
      - [Associated row class](#id14)
        - [`MutationTableRow`](#tskit.MutationTableRow)
          - [`MutationTableRow.site`](#tskit.MutationTableRow.site)
          - [`MutationTableRow.node`](#tskit.MutationTableRow.node)
          - [`MutationTableRow.derived_state`](#tskit.MutationTableRow.derived_state)
          - [`MutationTableRow.parent`](#tskit.MutationTableRow.parent)
          - [`MutationTableRow.metadata`](#tskit.MutationTableRow.metadata)
          - [`MutationTableRow.time`](#tskit.MutationTableRow.time)
          - [`MutationTableRow.asdict()`](#tskit.MutationTableRow.asdict)
          - [`MutationTableRow.replace()`](#tskit.MutationTableRow.replace)
    - [`PopulationTable` classes](#populationtable-classes)
      - [`PopulationTable`](#tskit.PopulationTable)
        - [`PopulationTable.add_row()`](#tskit.PopulationTable.add_row)
        - [`PopulationTable.set_columns()`](#tskit.PopulationTable.set_columns)
        - [`PopulationTable.append_columns()`](#tskit.PopulationTable.append_columns)
        - [`PopulationTable.__getitem__()`](#tskit.PopulationTable.__getitem__)
        - [`PopulationTable.append()`](#tskit.PopulationTable.append)
        - [`PopulationTable.asdict()`](#tskit.PopulationTable.asdict)
        - [`PopulationTable.assert_equals()`](#tskit.PopulationTable.assert_equals)
        - [`PopulationTable.clear()`](#tskit.PopulationTable.clear)
        - [`PopulationTable.copy()`](#tskit.PopulationTable.copy)
        - [`PopulationTable.drop_metadata()`](#tskit.PopulationTable.drop_metadata)
        - [`PopulationTable.equals()`](#tskit.PopulationTable.equals)
        - [`PopulationTable.keep_rows()`](#tskit.PopulationTable.keep_rows)
        - [`PopulationTable.metadata_schema`](#tskit.PopulationTable.metadata_schema)
        - [`PopulationTable.metadata_vector()`](#tskit.PopulationTable.metadata_vector)
        - [`PopulationTable.nbytes`](#tskit.PopulationTable.nbytes)
        - [`PopulationTable.packset_metadata()`](#tskit.PopulationTable.packset_metadata)
        - [`PopulationTable.truncate()`](#tskit.PopulationTable.truncate)
      - [Associated row class](#id15)
        - [`PopulationTableRow`](#tskit.PopulationTableRow)
          - [`PopulationTableRow.metadata`](#tskit.PopulationTableRow.metadata)
          - [`PopulationTableRow.asdict()`](#tskit.PopulationTableRow.asdict)
          - [`PopulationTableRow.replace()`](#tskit.PopulationTableRow.replace)
    - [`ProvenanceTable` classes](#provenancetable-classes)
      - [`ProvenanceTable`](#tskit.ProvenanceTable)
        - [`ProvenanceTable.add_row()`](#tskit.ProvenanceTable.add_row)
        - [`ProvenanceTable.set_columns()`](#tskit.ProvenanceTable.set_columns)
        - [`ProvenanceTable.append_columns()`](#tskit.ProvenanceTable.append_columns)
        - [`ProvenanceTable.packset_record()`](#tskit.ProvenanceTable.packset_record)
        - [`ProvenanceTable.packset_timestamp()`](#tskit.ProvenanceTable.packset_timestamp)
        - [`ProvenanceTable.equals()`](#tskit.ProvenanceTable.equals)
        - [`ProvenanceTable.assert_equals()`](#tskit.ProvenanceTable.assert_equals)
        - [`ProvenanceTable.append()`](#tskit.ProvenanceTable.append)
        - [`ProvenanceTable.asdict()`](#tskit.ProvenanceTable.asdict)
        - [`ProvenanceTable.clear()`](#tskit.ProvenanceTable.clear)
        - [`ProvenanceTable.copy()`](#tskit.ProvenanceTable.copy)
        - [`ProvenanceTable.keep_rows()`](#tskit.ProvenanceTable.keep_rows)
        - [`ProvenanceTable.nbytes`](#tskit.ProvenanceTable.nbytes)
        - [`ProvenanceTable.truncate()`](#tskit.ProvenanceTable.truncate)
      - [Associated row class](#id16)
        - [`ProvenanceTableRow`](#tskit.ProvenanceTableRow)
          - [`ProvenanceTableRow.timestamp`](#tskit.ProvenanceTableRow.timestamp)
          - [`ProvenanceTableRow.record`](#tskit.ProvenanceTableRow.record)
          - [`ProvenanceTableRow.asdict()`](#tskit.ProvenanceTableRow.asdict)
          - [`ProvenanceTableRow.replace()`](#tskit.ProvenanceTableRow.replace)
  - [Identity classes](#sec-python-api-reference-identity)
    - [The `IdentitySegments` class](#the-identitysegments-class)
      - [`IdentitySegments`](#tskit.IdentitySegments)
        - [`IdentitySegments.num_segments`](#tskit.IdentitySegments.num_segments)
        - [`IdentitySegments.num_pairs`](#tskit.IdentitySegments.num_pairs)
        - [`IdentitySegments.total_span`](#tskit.IdentitySegments.total_span)
        - [`IdentitySegments.pairs`](#tskit.IdentitySegments.pairs)
    - [The `IdentitySegmentList` class](#the-identitysegmentlist-class)
      - [`IdentitySegmentList`](#tskit.IdentitySegmentList)
        - [`IdentitySegmentList.total_span`](#tskit.IdentitySegmentList.total_span)
        - [`IdentitySegmentList.left`](#tskit.IdentitySegmentList.left)
        - [`IdentitySegmentList.right`](#tskit.IdentitySegmentList.right)
        - [`IdentitySegmentList.node`](#tskit.IdentitySegmentList.node)
    - [The `IdentitySegment` class](#the-identitysegment-class)
      - [`IdentitySegment`](#tskit.IdentitySegment)
        - [`IdentitySegment.left`](#tskit.IdentitySegment.left)
        - [`IdentitySegment.right`](#tskit.IdentitySegment.right)
        - [`IdentitySegment.node`](#tskit.IdentitySegment.node)
        - [`IdentitySegment.span`](#tskit.IdentitySegment.span)
  - [Miscellaneous classes](#miscellaneous-classes)
    - [The `ReferenceSequence` class](#the-referencesequence-class)
      - [`ReferenceSequence`](#tskit.ReferenceSequence)
        - [`ReferenceSequence.is_null()`](#tskit.ReferenceSequence.is_null)
        - [`ReferenceSequence.data`](#tskit.ReferenceSequence.data)
        - [`ReferenceSequence.metadata`](#tskit.ReferenceSequence.metadata)
        - [`ReferenceSequence.metadata_bytes`](#tskit.ReferenceSequence.metadata_bytes)
        - [`ReferenceSequence.metadata_schema`](#tskit.ReferenceSequence.metadata_schema)
    - [The `MetadataSchema` class](#the-metadataschema-class)
      - [`MetadataSchema`](#tskit.MetadataSchema)
        - [`MetadataSchema.asdict()`](#tskit.MetadataSchema.asdict)
        - [`MetadataSchema.validate_and_encode_row()`](#tskit.MetadataSchema.validate_and_encode_row)
        - [`MetadataSchema.decode_row()`](#tskit.MetadataSchema.decode_row)
        - [`MetadataSchema.encode_row()`](#tskit.MetadataSchema.encode_row)
        - [`MetadataSchema.structured_array_from_buffer()`](#tskit.MetadataSchema.structured_array_from_buffer)
        - [`MetadataSchema.permissive_json()`](#tskit.MetadataSchema.permissive_json)
        - [`MetadataSchema.null()`](#tskit.MetadataSchema.null)
    - [The `TableMetadataSchemas` class](#the-tablemetadataschemas-class)
      - [`TableMetadataSchemas`](#tskit.TableMetadataSchemas)
        - [`TableMetadataSchemas.node`](#tskit.TableMetadataSchemas.node)
        - [`TableMetadataSchemas.edge`](#tskit.TableMetadataSchemas.edge)
        - [`TableMetadataSchemas.site`](#tskit.TableMetadataSchemas.site)
        - [`TableMetadataSchemas.mutation`](#tskit.TableMetadataSchemas.mutation)
        - [`TableMetadataSchemas.migration`](#tskit.TableMetadataSchemas.migration)
        - [`TableMetadataSchemas.individual`](#tskit.TableMetadataSchemas.individual)
        - [`TableMetadataSchemas.population`](#tskit.TableMetadataSchemas.population)
    - [The `TopologyCounter` class](#the-topologycounter-class)
      - [`TopologyCounter`](#tskit.TopologyCounter)
    - [The `LdCalculator` class](#the-ldcalculator-class)
      - [`LdCalculator`](#tskit.LdCalculator)
        - [`LdCalculator.r2()`](#tskit.LdCalculator.r2)
        - [`LdCalculator.r2_array()`](#tskit.LdCalculator.r2_array)
        - [`LdCalculator.r2_matrix()`](#tskit.LdCalculator.r2_matrix)
    - [The `TableCollectionIndexes` class](#the-tablecollectionindexes-class)
      - [`TableCollectionIndexes`](#tskit.TableCollectionIndexes)
        - [`TableCollectionIndexes.asdict()`](#tskit.TableCollectionIndexes.asdict)
        - [`TableCollectionIndexes.nbytes`](#tskit.TableCollectionIndexes.nbytes)
    - [The `SVGString` class](#the-svgstring-class)
      - [`SVGString`](#tskit.SVGString)
        - [`SVGString._repr_svg_()`](#tskit.SVGString._repr_svg_)
    - [The `PCAResult` class](#the-pcaresult-class)
      - [`PCAResult`](#tskit.PCAResult)
        - [`PCAResult.factors`](#tskit.PCAResult.factors)
        - [`PCAResult.eigenvalues`](#tskit.PCAResult.eigenvalues)
        - [`PCAResult.range_sketch`](#tskit.PCAResult.range_sketch)
        - [`PCAResult.error_bound`](#tskit.PCAResult.error_bound)

By Tskit Developers

© Copyright 2022.