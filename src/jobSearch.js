export function filterJobs(jobs, filters) {
  const searchTerm = (filters.search ?? "").trim().toLowerCase();
  const locationTerm = (filters.locationSearch ?? "").trim().toLowerCase();

  return jobs.filter((job) => {
    const matchesSearch = `${job.title} ${job.company} ${job.category}`.toLowerCase().includes(searchTerm);
    const matchesLocation = `${job.location} ${job.remote ? "remote" : ""}`.toLowerCase().includes(locationTerm);
    const matchesCategory = filters.categoryFilter === "All Categories" || job.category === filters.categoryFilter;
    const matchesSchedule = filters.scheduleFilter === "Any schedule"
      || (filters.scheduleFilter === "Remote only" ? job.remote : job.type === filters.scheduleFilter);
    const matchesQuickFilter = filters.quickFilter === "All Jobs"
      || (filters.quickFilter === "Remote Jobs" ? job.remote : job.category === filters.quickFilter);

    return matchesSearch && matchesLocation && matchesCategory && matchesSchedule && matchesQuickFilter;
  });
}
