export type StaffMember = {
  id: string;
  name: string;
  stationId: string;
  qualifications: string[];
  assignedVehicleId?: string;
  inTraining?: boolean;
  trainingCourseId?: string;
};

export default function PersonnelView({ staff, stations, vehicles }: { staff: StaffMember[]; stations: any[]; vehicles: any[] }) {
  const getVehicleName = (vehicleId: string) => vehicles.find((v) => v.id === vehicleId)?.callsign || vehicles.find((v) => v.id === vehicleId)?.name || vehicleId;

  const getStaffStatus = (member: StaffMember): string => {
    if (member.inTraining) return 'In Ausbildung';
    if (member.assignedVehicleId) return `Zugewiesen: ${getVehicleName(member.assignedVehicleId)}`;
    return 'Verfügbar';
  };

  const getStatusColor = (member: StaffMember): string => {
    if (member.inTraining) return '#FF9800';
    if (member.assignedVehicleId) return '#2196F3';
    return '#4CAF50';
  };

  const groupedByStation = staff.reduce((acc, member) => {
    const stationId = member.stationId;
    if (!acc[stationId]) acc[stationId] = [];
    acc[stationId].push(member);
    return acc;
  }, {} as Record<string, StaffMember[]>);

  return (
    <div className="view-screen">
      <div className="screen-heading">
        <div>
          <span className="eyebrow">Personal</span>
          <h2>Personal</h2>
        </div>
        <span className="screen-count">{staff.length} Personen</span>
      </div>
      <div className="section-panel personnel-panel">
        {staff.length === 0 ? (
          <p style={{ padding: 16, textAlign: 'center', color: '#999' }}>Keine Personal vorhanden</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {stations
              .filter((station) => station.type === 'station')
              .map((station) => {
                const stationStaff = groupedByStation[station.id] || [];
                if (stationStaff.length === 0) return null;

                return (
                  <div key={station.id} style={{ borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                    <h3 style={{ marginBottom: 12, marginTop: 0 }}>
                      {station.name} ({stationStaff.length} Personal)
                    </h3>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {stationStaff.map((member) => (
                        <div
                          key={member.id}
                          style={{
                            border: '1px solid #ddd',
                            borderRadius: 8,
                            padding: 12,
                            backgroundColor: '#f9f9f9',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>
                              {member.name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: getStatusColor(member),
                                fontWeight: 'bold',
                                marginTop: 4,
                              }}
                            >
                              {getStaffStatus(member)}
                            </div>
                          </div>

                          {member.qualifications && member.qualifications.length > 0 && (
                            <div>
                              <label style={{ fontSize: 11, textTransform: 'uppercase', color: '#666' }}>
                                Qualifikationen
                              </label>
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 4,
                                  marginTop: 4,
                                }}
                              >
                                {member.qualifications.map((qual) => (
                                  <span
                                    key={qual}
                                    style={{
                                      fontSize: 11,
                                      backgroundColor: '#e0e0e0',
                                      padding: '3px 8px',
                                      borderRadius: 12,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {qual}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
