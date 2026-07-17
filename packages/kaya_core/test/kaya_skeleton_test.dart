import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets('KayaSkeletonList renders `count` list tiles', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KayaSkeletonList(count: 3)));
    expect(find.byType(KayaSkeletonListTile), findsNWidgets(3));
  });

  testWidgets('KayaSkeletonList defaults to 4 tiles', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KayaSkeletonList()));
    expect(find.byType(KayaSkeletonListTile), findsNWidgets(4));
  });

  testWidgets('KayaSkeletonCard renders without error', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KayaSkeletonCard()));
    expect(find.byType(KayaSkeletonCard), findsOneWidget);
    expect(find.byType(KayaSkeletonBox), findsWidgets);
  });

  testWidgets('KayaSkeletonBox honors shape: circle', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: KayaSkeletonBox(width: 44, height: 44, shape: BoxShape.circle)),
    );
    final container = tester.widget<Container>(find.byType(Container));
    final decoration = container.decoration as BoxDecoration;
    expect(decoration.shape, BoxShape.circle);
  });
}
