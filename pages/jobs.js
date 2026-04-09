// pages/jobs.js — Scale Army Client Job Openings Dashboard
import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Jobs.module.css';

export default function Jobs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [expanded, setExpanded] = useState({});

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/jobs-data');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      const exp = {};
      json.clients.forEach(c => { exp[c.domain] = true; });
      setExpanded(exp);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleExpand = domain => setExpanded(e => ({ ...e, [domain]: !e[domain] }));

  const filteredClients = data?.clients?.map(client => ({
    ...client,
    jobs: client.jobs.filter(j => {
      const matchSearch = !search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.location.toLowerCase().includes(search.toLowerCase()) ||
        client.name.toLowerCase().includes(search.toLowerCase());
      const matchSource = sourceFilter === 'all' || j.source === sourceFilter;
      return matchSearch && matchSource;
    }),
  })).filter(c => !search || c.jobs.length > 0 || c.name.toLowerCase().includes(search.toLowerCase()));

  const totalJobs = data?.clients?.reduce((s, c) => s + (c.totalJobs || 0), 0) || 0;
  const totalClients = data?.clients?.length || 0;
  const hiringClients = data?.clients?.filter(c => c.totalJobs > 0).length || 0;
  const fetchedAt = data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <>
      <Head>
        <title>Scale Army — Client Job Openings</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.logo}>S</div>
          <div>
            <div className={styles.headerTitle}>scalearmy</div>
            <div className={styles.headerSub}>Client Job Openings Monitor</div>
          </div>
          <a href="/" className={styles.backBtn}>← Audit Tool</a>
        </header>

        <main className={styles.main}>

          {/* Stats */}
          {data && !loading && (
            <div className={styles.statsBar}>
              <div className={styles.stat}>
                <div className={styles.statVal}>{totalClients}</div>
                <div className={styles.statLbl}>Clients monitored</div>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <div className={styles.statVal}>{totalJobs}</div>
                <div className={styles.statLbl}>Total open roles</div>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <div className={styles.statVal}>{hiringClients}</div>
                <div className={styles.statLbl}>Clients actively hiring</div>
              </div>
              <div className={styles.statRight}>
                <span className={styles.fetchedAt}>Updated at {fetchedAt}</span>
                <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
                  ↻ Refresh
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          {data && !loading && (
            <div className={styles.filters}>
              <input
                className={styles.search}
                placeholder="Search by company, title, or location..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className={styles.sourceToggle}>
                {['all', 'Apollo', 'Career page'].map(s => (
                  <button key={s}
                    className={`${styles.sourceBtn} ${sourceFilter === s ? styles.sourceBtnActive : ''}`}
                    onClick={() => setSourceFilter(s)}>
                    {s === 'all' ? 'All sources' : s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
              <div className={styles.loadingTitle}>Fetching job postings...</div>
              <div className={styles.loadingNote}>Checking Apollo database and company career pages. This takes 30–60 seconds.</div>
            </div>
          )}

          {/* Error */}
          {error && <div className={styles.errorBox}>⚠️ {error}</div>}

          {/* Client cards */}
          {!loading && filteredClients?.map(client => (
            <div key={client.domain} className={styles.clientCard}>
              <div className={styles.clientHeader} onClick={() => toggleExpand(client.domain)}>
                <div className={styles.clientLeft}>
                  <div className={styles.clientName}>{client.name}</div>
                  <div className={styles.clientMeta}>
                    <span className={styles.clientDomain}>{client.domain}</span>
                    {client.apolloJobs > 0 && <span className={styles.srcBadge}>Apollo: {client.apolloJobs}</span>}
                    {client.scrapeJobs > 0 && <span className={`${styles.srcBadge} ${styles.srcBadgeScrape}`}>Career page: {client.scrapeJobs}</span>}
                  </div>
                </div>
                <div className={styles.clientRight}>
                  {client.error ? (
                    <span className={styles.notFound}>Not found</span>
                  ) : (
                    <span className={client.totalJobs > 0 ? styles.jobCount : styles.jobCountEmpty}>
                      {client.totalJobs} open role{client.totalJobs !== 1 ? 's' : ''}
                    </span>
                  )}
                  {client.linkedinUrl && (
                    <a href={client.linkedinUrl} target="_blank" rel="noopener noreferrer"
                      className={styles.liLink} onClick={e => e.stopPropagation()}>LinkedIn →</a>
                  )}
                  <span className={styles.chevron}>{expanded[client.domain] ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded[client.domain] && (
                <div className={styles.jobsWrap}>
                  {client.jobs.length === 0 ? (
                    <div className={styles.noJobs}>No open roles found for this client right now.</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Job title</th>
                          <th>Location</th>
                          <th>Posted</th>
                          <th>Source</th>
                          <th>Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {client.jobs.map((job, i) => (
                          <tr key={job.id} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                            <td className={styles.jobTitle}>{job.title}</td>
                            <td className={styles.jobLoc}>{job.location}</td>
                            <td>
                              {job.postedAgo
                                ? <span className={job.postedAgo === 'Today' ? styles.badgeNew : styles.badgeOld}>{job.postedAgo}</span>
                                : <span className={styles.badgeOld}>Unknown</span>}
                            </td>
                            <td>
                              <span className={job.source === 'Apollo' ? styles.badgeApollo : styles.badgeScrape}>
                                {job.source}
                              </span>
                            </td>
                            <td>
                              {job.url
                                ? <a href={job.url} target="_blank" rel="noopener noreferrer" className={styles.viewLink}>View →</a>
                                : <span className={styles.noLink}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}

        </main>
      </div>
    </>
  );
}
