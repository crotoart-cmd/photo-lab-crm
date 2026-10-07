package com.nuocleo.devicesmtp;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Resolve hostname — fallback DNS UDP 8.8.8.8 khi getaddrinfo hệ thống lỗi (ROM PRC). */
final class DnsResolver {
  private DnsResolver() {}

  static InetAddress[] resolve(String host) throws Exception {
    try {
      InetAddress[] system = InetAddress.getAllByName(host);
      if (system != null && system.length > 0) return system;
    } catch (Exception ignored) {
      // fallback bên dưới
    }
    List<InetAddress> viaGoogle = resolveViaUdp(host, "8.8.8.8");
    if (!viaGoogle.isEmpty()) return viaGoogle.toArray(new InetAddress[0]);
    List<InetAddress> viaCloudflare = resolveViaUdp(host, "1.1.1.1");
    if (!viaCloudflare.isEmpty()) return viaCloudflare.toArray(new InetAddress[0]);
    throw new Exception("Không resolve được " + host + " (hệ thống + 8.8.8.8 + 1.1.1.1)");
  }

  private static List<InetAddress> resolveViaUdp(String host, String dnsServer) throws Exception {
    byte[] query = buildQuery(host);
    try (DatagramSocket socket = new DatagramSocket()) {
      socket.setSoTimeout(4000);
      DatagramPacket packet =
          new DatagramPacket(
              query, query.length, InetAddress.getByName(dnsServer), 53);
      socket.send(packet);
      byte[] buf = new byte[512];
      DatagramPacket resp = new DatagramPacket(buf, buf.length);
      socket.receive(resp);
      return parseARecords(buf, resp.getLength());
    }
  }

  private static byte[] buildQuery(String host) throws Exception {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    DataOutputStream out = new DataOutputStream(baos);
    out.writeShort(0x1234); // id
    out.writeShort(0x0100); // recursion desired
    out.writeShort(1); // questions
    out.writeShort(0);
    out.writeShort(0);
    out.writeShort(0);
    for (String label : host.split("\\.")) {
      byte[] bytes = label.getBytes(StandardCharsets.US_ASCII);
      out.writeByte(bytes.length);
      out.write(bytes);
    }
    out.writeByte(0);
    out.writeShort(1); // A
    out.writeShort(1); // IN
    out.flush();
    return baos.toByteArray();
  }

  private static List<InetAddress> parseARecords(byte[] data, int length) throws Exception {
    List<InetAddress> out = new ArrayList<>();
    if (length < 12) return out;
    DataInputStream in = new DataInputStream(new java.io.ByteArrayInputStream(data, 0, length));
    in.readUnsignedShort(); // id
    in.readUnsignedShort(); // flags
    int qdcount = in.readUnsignedShort();
    int ancount = in.readUnsignedShort();
    in.readUnsignedShort();
    in.readUnsignedShort();
    for (int i = 0; i < qdcount; i++) {
      skipName(in);
      in.readUnsignedShort();
      in.readUnsignedShort();
    }
    for (int i = 0; i < ancount; i++) {
      skipName(in);
      int type = in.readUnsignedShort();
      in.readUnsignedShort(); // class
      in.readInt(); // ttl
      int rdlength = in.readUnsignedShort();
      if (type == 1 && rdlength == 4) {
        byte[] addr = new byte[4];
        in.readFully(addr);
        out.add(InetAddress.getByAddress(addr));
      } else {
        in.skipBytes(rdlength);
      }
    }
    return out;
  }

  private static void skipName(DataInputStream in) throws Exception {
    while (true) {
      int len = in.readUnsignedByte();
      if (len == 0) return;
      if ((len & 0xC0) == 0xC0) {
        in.readUnsignedByte();
        return;
      }
      in.skipBytes(len);
    }
  }
}
